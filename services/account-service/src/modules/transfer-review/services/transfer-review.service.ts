import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@ecoswift/database';
import { EVENT_PUBLISHER, TRANSFER_COMPLETED } from '@ecoswift/event-bus';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { RECEIPTS_QUEUE } from '@ecoswift/queue';
import type { QueuePort, ReceiptJobPayload } from '@ecoswift/queue';
import { AuditService } from '../../../common/services/audit.service';
import { AccountNotificationService } from '../../../common/services/account-notification.service';
import { resolveHighValueTransferThreshold } from '../../../common/services/transfer-thresholds';
import { LedgerPostingService } from '../../transfers/services/ledger-posting.service';
import { CASH_LEDGER_ACCOUNT_CODE } from '../../transfers/services/external-transfer.service';
import type {
  TransferReviewDetailDto,
  TransferReviewListItemDto,
  TransferReviewStatusFilter,
} from '../dto/transfer-review.dto';

const reviewInclude = {
  currency: true,
  sourceAccount: {
    include: { accountType: true, customer: { include: { user: { include: { profile: true } } } } },
  },
  transferRequest: {
    include: {
      destinationAccount: true,
      destinationBeneficiary: true,
      approvals: { include: { checker: { include: { profile: true } } } },
    },
  },
} satisfies Prisma.TransactionInclude;

type ReviewableTransaction = Prisma.TransactionGetPayload<{ include: typeof reviewInclude }>;
type TransferApprovalRow = NonNullable<ReviewableTransaction['transferRequest']>['approvals'][number];

/**
 * Resolves transfers `InternalTransferService`/`ExternalTransferService`
 * held for manual review (`Transaction.status = PENDING`, no ledger
 * entries posted — see those services' doc comments). Approving here must
 * settle through the *same* ledger-posting path a normal transfer takes
 * (`LedgerPostingService`) rather than a staff-only shortcut, per the
 * milestone 2 brief: "Administrators should not bypass the standard ledger
 * workflow." Maker-checker is enforced literally — the staff member who
 * resolves a hold may not be the customer who initiated it (checked via
 * `TransferApproval.makerId`, which is always the customer's own userId
 * for this flow, never a staff id).
 */
@Injectable()
export class TransferReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: AccountNotificationService,
    private readonly ledgerPostingService: LedgerPostingService,
    private readonly configService: ConfigService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
    @Inject(RECEIPTS_QUEUE) private readonly receiptsQueue: QueuePort<ReceiptJobPayload>,
  ) {}

  async list(status: TransferReviewStatusFilter = 'PENDING'): Promise<TransferReviewListItemDto[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: { transferRequest: { approvals: { some: { status } } } },
      include: reviewInclude,
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    });
    return transactions.map((t) => this.toListItemDto(t));
  }

  async getById(transactionId: string): Promise<TransferReviewDetailDto> {
    const transaction = await this.loadReviewable(transactionId);
    return this.toDetailDto(transaction);
  }

  async approve(staffUserId: string, transactionId: string, comments: string | undefined): Promise<TransferReviewDetailDto> {
    const transaction = await this.loadReviewable(transactionId);
    const approval = this.currentApproval(transaction);
    this.assertPendingAndNotOwnRequest(transaction, approval, staffUserId);

    const sourceAccount = transaction.sourceAccount!;
    const balance = await this.prisma.accountBalance.findUniqueOrThrow({ where: { accountId: sourceAccount.id } });
    const amount = Number(transaction.amount);
    if (!sourceAccount.accountType.allowsOverdraft && Number(balance.availableBalance) < amount) {
      throw new BadRequestException(
        'This account no longer has sufficient available balance to approve this transfer — consider rejecting it instead',
      );
    }

    const transferRequest = transaction.transferRequest!;
    const label = transaction.description ?? `Approved transfer ${transaction.transactionReference}`;

    const { completed, journalEntryId } = await this.prisma.$transaction(async (tx) => {
      let journalEntryId: string;

      if (transferRequest.transferChannel === 'INTERNAL') {
        const destinationAccountId = transferRequest.destinationAccountId!;
        const [sourceLedgerAccount, destinationLedgerAccount] = await Promise.all([
          tx.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: sourceAccount.id } }),
          tx.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: destinationAccountId } }),
        ]);
        const posted = await this.ledgerPostingService.postInternalTransfer(tx, {
          transactionId: transaction.id,
          sourceAccountId: sourceAccount.id,
          sourceLedgerAccountId: sourceLedgerAccount.id,
          destinationAccountId,
          destinationLedgerAccountId: destinationLedgerAccount.id,
          amount,
          currencyId: transaction.currencyId,
          description: label,
        });
        journalEntryId = posted.journalEntryId;
      } else {
        const [sourceLedgerAccount, cashLedgerAccount] = await Promise.all([
          tx.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: sourceAccount.id } }),
          tx.ledgerAccount.findUniqueOrThrow({ where: { code: CASH_LEDGER_ACCOUNT_CODE } }),
        ]);
        const posted = await this.ledgerPostingService.postExternalTransfer(tx, {
          transactionId: transaction.id,
          sourceAccountId: sourceAccount.id,
          sourceLedgerAccountId: sourceLedgerAccount.id,
          cashLedgerAccountId: cashLedgerAccount.id,
          amount,
          currencyId: transaction.currencyId,
          description: label,
        });
        journalEntryId = posted.journalEntryId;
      }

      const completed = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.transferApproval.update({
        where: { id: approval.id },
        data: { status: 'APPROVED', checkerId: staffUserId, checkerActionAt: new Date(), comments },
      });

      return { completed, journalEntryId };
    });

    await this.eventPublisher.publish({
      eventType: TRANSFER_COMPLETED,
      producerContext: 'account-service',
      payload: {
        transactionId: completed.id,
        transactionReference: transaction.transactionReference,
        journalEntryId,
        completedAt: completed.completedAt!.toISOString(),
      },
    });

    await this.auditService.record({
      actorUserId: staffUserId,
      actorType: 'STAFF',
      actionType: 'APPROVE',
      resourceType: 'Transaction',
      resourceId: transaction.id,
      description: `Approved held transfer: ${label}`,
      beforeState: { status: 'PENDING' },
      afterState: { status: 'COMPLETED', comments },
    });

    await this.receiptsQueue.enqueue({ transactionId: transaction.id, format: 'JSON' });

    const customer = sourceAccount.customer;
    const destinationLabel = this.destinationLabel(transferRequest);
    await this.notificationService.sendEmail({
      customerId: customer.id,
      toAddress: customer.user.email,
      templateCode: 'TRANSFER_COMPLETED_EMAIL',
      variables: {
        firstName: customer.user.profile?.firstName ?? 'there',
        amount: amount.toFixed(2),
        currencyCode: transaction.currency.isoCode,
        sourceAccountNumber: sourceAccount.accountNumber,
        destinationAccountNumber: destinationLabel,
        transactionReference: transaction.transactionReference,
        portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
        year: String(new Date().getFullYear()),
      },
    });

    const largeTransferThreshold = await resolveHighValueTransferThreshold(this.prisma);
    if (amount >= largeTransferThreshold) {
      await this.notificationService.sendEmail({
        customerId: customer.id,
        toAddress: customer.user.email,
        templateCode: 'LARGE_TRANSFER_ALERT_EMAIL',
        priority: 'HIGH',
        variables: {
          firstName: customer.user.profile?.firstName ?? 'there',
          amount: amount.toFixed(2),
          currencyCode: transaction.currency.isoCode,
          sourceAccountNumber: sourceAccount.accountNumber,
          destinationAccountNumber: destinationLabel,
          transactionReference: transaction.transactionReference,
          portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
          year: String(new Date().getFullYear()),
        },
      });
    }

    return this.getById(transactionId);
  }

  async reject(staffUserId: string, transactionId: string, reason: string): Promise<TransferReviewDetailDto> {
    const transaction = await this.loadReviewable(transactionId);
    const approval = this.currentApproval(transaction);
    this.assertPendingAndNotOwnRequest(transaction, approval, staffUserId);

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'REJECTED', failureReason: reason, failedAt: new Date() },
      }),
      this.prisma.transferApproval.update({
        where: { id: approval.id },
        data: { status: 'REJECTED', checkerId: staffUserId, checkerActionAt: new Date(), comments: reason },
      }),
    ]);

    await this.auditService.record({
      actorUserId: staffUserId,
      actorType: 'STAFF',
      actionType: 'REJECT',
      resourceType: 'Transaction',
      resourceId: transaction.id,
      description: `Rejected held transfer: ${reason}`,
      beforeState: { status: 'PENDING' },
      afterState: { status: 'REJECTED', reason },
    });

    const sourceAccount = transaction.sourceAccount!;
    const customer = sourceAccount.customer;
    await this.notificationService.sendEmail({
      customerId: customer.id,
      toAddress: customer.user.email,
      templateCode: 'TRANSFER_FAILED_EMAIL',
      variables: {
        firstName: customer.user.profile?.firstName ?? 'there',
        amount: Number(transaction.amount).toFixed(2),
        currencyCode: transaction.currency.isoCode,
        sourceAccountNumber: sourceAccount.accountNumber,
        reason: `Declined during review: ${reason}`,
        portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
        year: String(new Date().getFullYear()),
      },
    });

    return this.getById(transactionId);
  }

  private async loadReviewable(transactionId: string): Promise<ReviewableTransaction> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: reviewInclude,
    });
    if (!transaction || !transaction.transferRequest) {
      throw new NotFoundException('No held transfer found for this id');
    }
    return transaction;
  }

  private currentApproval(transaction: ReviewableTransaction): TransferApprovalRow {
    const approvals = transaction.transferRequest!.approvals;
    const [latest] = [...approvals].sort((a, b) => b.makerActionAt.getTime() - a.makerActionAt.getTime());
    if (!latest) throw new NotFoundException('This held transfer has no approval record');
    return latest;
  }

  private assertPendingAndNotOwnRequest(
    transaction: ReviewableTransaction,
    approval: TransferApprovalRow,
    staffUserId: string,
  ): void {
    if (transaction.status !== 'PENDING' || approval.status !== 'PENDING') {
      throw new BadRequestException('This transfer has already been resolved');
    }
    if (approval.makerId === staffUserId) {
      throw new ForbiddenException('You cannot review a transfer you initiated yourself');
    }
  }

  private destinationLabel(transferRequest: ReviewableTransaction['transferRequest']): string {
    if (transferRequest!.destinationAccount) return transferRequest!.destinationAccount.accountNumber;
    if (transferRequest!.destinationBeneficiary) {
      return `${transferRequest!.destinationBeneficiary.beneficiaryName} (${transferRequest!.destinationBeneficiary.accountNumber})`;
    }
    return 'unknown';
  }

  private toListItemDto(transaction: ReviewableTransaction): TransferReviewListItemDto {
    const transferRequest = transaction.transferRequest!;
    const [approval] = [...transferRequest.approvals].sort((a, b) => b.makerActionAt.getTime() - a.makerActionAt.getTime());
    const sourceAccount = transaction.sourceAccount!;
    const customer = sourceAccount.customer;
    const profile = customer.user.profile;

    return {
      id: transaction.id,
      transactionReference: transaction.transactionReference,
      transferChannel: transferRequest.transferChannel,
      amount: String(transaction.amount),
      currencyCode: transaction.currency.isoCode,
      sourceAccountNumber: sourceAccount.accountNumber,
      destinationLabel: this.destinationLabel(transferRequest),
      customerName: profile ? `${profile.firstName} ${profile.lastName}` : customer.user.email,
      customerEmail: customer.user.email,
      description: transaction.description ?? undefined,
      approvalStatus: approval?.status ?? 'PENDING',
      checkerName: approval?.checker?.profile ? `${approval.checker.profile.firstName} ${approval.checker.profile.lastName}` : undefined,
      comments: approval?.comments ?? undefined,
      heldAt: transaction.createdAt.toISOString(),
      resolvedAt: approval?.checkerActionAt?.toISOString() ?? undefined,
    };
  }

  private toDetailDto(transaction: ReviewableTransaction): TransferReviewDetailDto {
    const metadata = transaction.metadata as { fraudSignals?: { signalType: string; score: number; reason?: string }[] } | null;
    return {
      ...this.toListItemDto(transaction),
      fraudSignals: metadata?.fraudSignals ?? [],
    };
  }
}

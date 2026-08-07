import { randomInt } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@ecoswift/database';
import { EVENT_PUBLISHER, TRANSFER_COMPLETED } from '@ecoswift/event-bus';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { RECEIPTS_QUEUE } from '@ecoswift/queue';
import type { QueuePort, ReceiptJobPayload } from '@ecoswift/queue';
import { MfaRequiredException } from '@ecoswift/shared';
import type { FraudSignal } from '@ecoswift/security';
import { AuditService } from '../../../common/services/audit.service';
import { AccountNotificationService } from '../../../common/services/account-notification.service';
import { resolveHighValueTransferThreshold } from '../../../common/services/transfer-thresholds';
import { TransferLimitsService } from './transfer-limits.service';
import { LedgerPostingService } from './ledger-posting.service';
import { TransferRiskService } from './transfer-risk.service';
import type { TransferResponseDto } from '../dto/transfer-response.dto';

/**
 * Money movement between two accounts the SAME authenticated customer
 * owns (e.g. their own Checking -> Savings) — the "Internal transfer"
 * type from the milestone 2 brief's Transfer Types list, and the only
 * transfer type that settles synchronously within this platform's own
 * ledger, because both ends are already accounts this bank carries.
 *
 * Milestone 2 security phase: every attempt runs through
 * `TransferRiskService` (velocity / new-device / high-value signals). If
 * any signal fires, this either demands a valid TOTP step-up code
 * (`MfaRequiredException` — the caller resubmits with `mfaCode`) or, if
 * the customer has no MFA enrolled to step up with at all, the transfer
 * is held: a `Transaction` + `TransferRequest` + `TransferApproval`
 * (PENDING) are recorded, but `LedgerPostingService` is never called, so
 * no balance moves until a staff member resolves it. This phase builds
 * the hold mechanism and the data it produces; the staff-facing
 * approve/reject console that resolves a held transfer is a later phase
 * — flagged, not silently missing.
 */
@Injectable()
export class InternalTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: AccountNotificationService,
    private readonly limitsService: TransferLimitsService,
    private readonly ledgerPostingService: LedgerPostingService,
    private readonly riskService: TransferRiskService,
    private readonly configService: ConfigService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
    @Inject(RECEIPTS_QUEUE) private readonly receiptsQueue: QueuePort<ReceiptJobPayload>,
  ) {}

  async transfer(
    userId: string,
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    description: string | undefined,
    mfaCode?: string,
    deviceId?: string,
  ): Promise<TransferResponseDto> {
    if (sourceAccountId === destinationAccountId) {
      throw new BadRequestException('Source and destination accounts must be different');
    }

    const [sourceAccount, destinationAccount] = await Promise.all([
      this.loadOwnedActiveAccount(userId, sourceAccountId),
      this.loadOwnedActiveAccount(userId, destinationAccountId),
    ]);

    if (sourceAccount.customerId !== destinationAccount.customerId) {
      // Should be unreachable — both were just proven owned by `userId` — but
      // asserted explicitly since this is the exact invariant that keeps
      // "internal transfer" from ever becoming an unauthorized transfer
      // between two different customers.
      throw new ForbiddenException('Both accounts must belong to the same customer for an internal transfer');
    }
    if (sourceAccount.currencyId !== destinationAccount.currencyId) {
      throw new BadRequestException('Internal transfers between accounts in different currencies are not supported yet');
    }

    const balance = await this.prisma.accountBalance.findUniqueOrThrow({ where: { accountId: sourceAccountId } });
    if (!sourceAccount.accountType.allowsOverdraft && Number(balance.availableBalance) < amount) {
      throw new BadRequestException('Insufficient available balance for this transfer');
    }

    await this.limitsService.assertWithinLimits({
      customerId: sourceAccount.customerId,
      accountId: sourceAccountId,
      kycTier: sourceAccount.customer.tier,
      currencyId: sourceAccount.currencyId,
      amount,
    });

    const { hold: holdForReview, signals: holdSignals } = await this.resolveStepUp(
      userId,
      deviceId,
      amount,
      sourceAccount.currency.isoCode,
      mfaCode,
    );

    const transferType = await this.prisma.transactionType.findUniqueOrThrow({ where: { code: 'TRANSFER_INTERNAL' } });
    const sourceLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: sourceAccountId } });
    const destinationLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: destinationAccountId } });
    const reference = await this.generateTransactionReference();
    const label = description?.trim() || `Transfer from ${sourceAccount.accountNumber} to ${destinationAccount.accountNumber}`;

    if (holdForReview) {
      const held = await this.prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            transactionReference: reference,
            transactionTypeId: transferType.id,
            sourceAccountId,
            destinationAccountId,
            amount,
            currencyId: sourceAccount.currencyId,
            status: 'PENDING',
            initiatedBy: userId,
            description: label,
            metadata: { fraudSignals: holdSignals } as unknown as Prisma.InputJsonValue,
          },
        });
        const transferRequest = await tx.transferRequest.create({
          data: {
            transactionId: transaction.id,
            transferChannel: 'INTERNAL',
            sourceAccountId,
            destinationAccountId,
            requestedAmount: amount,
            narrative: label,
          },
        });
        await tx.transferApproval.create({
          data: { transferRequestId: transferRequest.id, makerId: userId, status: 'PENDING' },
        });
        return transaction;
      });

      await this.auditService.record({
        actorUserId: userId,
        actorType: 'CUSTOMER',
        actionType: 'CREATE',
        resourceType: 'Transaction',
        resourceId: held.id,
        description: `Held for manual review: ${label}`,
        afterState: { amount, direction: 'TRANSFER_INTERNAL', sourceAccountId, destinationAccountId, status: 'PENDING' },
      });

      const heldCustomer = await this.prisma.customer.findUniqueOrThrow({
        where: { id: sourceAccount.customerId },
        include: { user: { include: { profile: true } } },
      });
      await this.notificationService.sendEmail({
        customerId: sourceAccount.customerId,
        toAddress: heldCustomer.user.email,
        templateCode: 'TRANSFER_INITIATED_EMAIL',
        variables: {
          firstName: heldCustomer.user.profile?.firstName ?? 'there',
          amount: amount.toFixed(2),
          currencyCode: sourceAccount.currency.isoCode,
          sourceAccountNumber: sourceAccount.accountNumber,
          destinationAccountNumber: destinationAccount.accountNumber,
          transactionReference: reference,
          portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
          year: String(new Date().getFullYear()),
        },
      });

      return this.toResponseDto(held, sourceAccount.currency.isoCode);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          transactionReference: reference,
          transactionTypeId: transferType.id,
          sourceAccountId,
          destinationAccountId,
          amount,
          currencyId: sourceAccount.currencyId,
          status: 'PROCESSING',
          initiatedBy: userId,
          description: label,
        },
      });

      await tx.transferRequest.create({
        data: {
          transactionId: transaction.id,
          transferChannel: 'INTERNAL',
          sourceAccountId,
          destinationAccountId,
          requestedAmount: amount,
          narrative: label,
        },
      });

      const { journalEntryId, journalNumber } = await this.ledgerPostingService.postInternalTransfer(tx, {
        transactionId: transaction.id,
        sourceAccountId,
        sourceLedgerAccountId: sourceLedgerAccount.id,
        destinationAccountId,
        destinationLedgerAccountId: destinationLedgerAccount.id,
        amount,
        currencyId: sourceAccount.currencyId,
        description: label,
      });

      const completed = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      return { transaction: completed, journalEntryId, journalNumber };
    });

    await this.eventPublisher.publish({
      eventType: TRANSFER_COMPLETED,
      producerContext: 'account-service',
      payload: {
        transactionId: result.transaction.id,
        transactionReference: reference,
        journalEntryId: result.journalEntryId,
        completedAt: result.transaction.completedAt!.toISOString(),
      },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'CREATE',
      resourceType: 'Transaction',
      resourceId: result.transaction.id,
      description: label,
      afterState: { amount, direction: 'TRANSFER_INTERNAL', sourceAccountId, destinationAccountId },
    });

    await this.receiptsQueue.enqueue({ transactionId: result.transaction.id, format: 'JSON' });

    const customerWithUser = await this.prisma.customer.findUniqueOrThrow({
      where: { id: sourceAccount.customerId },
      include: { user: { include: { profile: true } } },
    });
    await this.notificationService.sendEmail({
      customerId: sourceAccount.customerId,
      toAddress: customerWithUser.user.email,
      templateCode: 'TRANSFER_COMPLETED_EMAIL',
      variables: {
        firstName: customerWithUser.user.profile?.firstName ?? 'there',
        amount: amount.toFixed(2),
        currencyCode: sourceAccount.currency.isoCode,
        sourceAccountNumber: sourceAccount.accountNumber,
        destinationAccountNumber: destinationAccount.accountNumber,
        transactionReference: reference,
        portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
        year: String(new Date().getFullYear()),
      },
    });

    const largeTransferThreshold = await resolveHighValueTransferThreshold(this.prisma);
    if (amount >= largeTransferThreshold) {
      await this.notificationService.sendEmail({
        customerId: sourceAccount.customerId,
        toAddress: customerWithUser.user.email,
        templateCode: 'LARGE_TRANSFER_ALERT_EMAIL',
        priority: 'HIGH',
        variables: {
          firstName: customerWithUser.user.profile?.firstName ?? 'there',
          amount: amount.toFixed(2),
          currencyCode: sourceAccount.currency.isoCode,
          sourceAccountNumber: sourceAccount.accountNumber,
          destinationAccountNumber: destinationAccount.accountNumber,
          transactionReference: reference,
          portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
          year: String(new Date().getFullYear()),
        },
      });
    }

    return this.toResponseDto(result.transaction, sourceAccount.currency.isoCode);
  }

  /**
   * Returns `hold: true` (plus the triggered `FraudSignal[]`, so the hold
   * carries a reason a reviewer can actually see — see `holdForReview`'s
   * use of it below) if the transfer must wait for manual review
   * (risk-flagged, no MFA available to step up with). Throws
   * `MfaRequiredException`/`BadRequestException` for the other two
   * risk-flagged outcomes. `hold: false` when nothing was flagged.
   */
  private async resolveStepUp(
    userId: string,
    deviceId: string | undefined,
    amount: number,
    currencyCode: string,
    mfaCode: string | undefined,
  ): Promise<{ hold: boolean; signals: FraudSignal[] }> {
    const risk = await this.riskService.assess({ userId, deviceId, amount, currencyCode });
    if (!risk.requiresStepUp) return { hold: false, signals: [] };

    if (mfaCode) {
      const valid = await this.riskService.verifyStepUpCode(userId, mfaCode);
      if (!valid) throw new BadRequestException('Invalid or expired verification code');
      return { hold: false, signals: [] };
    }

    if (await this.riskService.hasTotpEnrolled(userId)) {
      throw new MfaRequiredException('This transfer requires a verification code from your authenticator app');
    }

    return { hold: true, signals: risk.signals }; // No MFA to step up with — hold for staff review instead of blocking outright.
  }

  private async loadOwnedActiveAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { customer: true, currency: true, accountType: true },
    });
    if (!account || account.customer.userId !== userId) {
      throw new NotFoundException('Account not found');
    }
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException(`Account must be ACTIVE to transact (current status: ${account.status})`);
    }
    return account;
  }

  private async generateTransactionReference(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `TRF${randomInt(100_000_000, 999_999_999)}`;
      const existing = await this.prisma.transaction.findUnique({ where: { transactionReference: candidate } });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique transaction reference');
  }

  private toResponseDto(
    transaction: {
      id: string;
      transactionReference: string;
      sourceAccountId: string | null;
      destinationAccountId: string | null;
      amount: unknown;
      status: string;
      description: string | null;
      createdAt: Date;
      completedAt: Date | null;
    },
    currencyCode: string,
  ): TransferResponseDto {
    return {
      id: transaction.id,
      transactionReference: transaction.transactionReference,
      transferType: 'TRANSFER_INTERNAL',
      sourceAccountId: transaction.sourceAccountId ?? undefined,
      destinationAccountId: transaction.destinationAccountId ?? undefined,
      amount: String(transaction.amount),
      currencyCode,
      status: transaction.status,
      description: transaction.description ?? undefined,
      sandbox: false,
      createdAt: transaction.createdAt.toISOString(),
      completedAt: transaction.completedAt?.toISOString(),
    };
  }
}

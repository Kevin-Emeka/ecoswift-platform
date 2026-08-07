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
import { BeneficiariesService } from '../../beneficiaries/services/beneficiaries.service';
import { TransferLimitsService } from './transfer-limits.service';
import { TransferRiskService } from './transfer-risk.service';
import { LedgerPostingService } from './ledger-posting.service';
import type { TransferResponseDto } from '../dto/transfer-response.dto';

export interface WireBeneficiaryDetails {
  beneficiaryName: string;
  accountNumber: string;
  // Optional here (unlike ExternalTransferDto, where they're required) —
  // this type is also used by ScheduledTransferWorker replaying an
  // existing saved Beneficiary, which may predate these fields.
  bankName?: string;
  swiftBic?: string;
  bankAddress?: string;
  bankCountryCode?: string;
  routingNumber?: string;
  currencyCode: string;
}

export const CASH_LEDGER_ACCOUNT_CODE = '1000';

/**
 * International wire transfers — an account at another institution,
 * anywhere in the world. The full beneficiary + beneficiary-bank detail
 * (name, account/IBAN, bank name, SWIFT/BIC, bank address/country,
 * routing number) is captured inline on the transfer form itself; there
 * is no separate "add and verify a beneficiary first" prerequisite
 * (`BeneficiariesService.findOrCreateForWire` persists it behind the
 * scenes purely so it shows up for reuse afterwards — see that method's
 * doc comment for why skipping the old verification step is safe: it was
 * never a real control to begin with).
 *
 * This platform has no real ACH/wire rail or licensed banking partner, so
 * unlike `InternalTransferService`, money does not and cannot actually
 * leave to a real external bank here. Rather than silently pretending
 * otherwise (which would be indistinguishable from advance-fee fraud —
 * take real account details, claim the money moved, nothing happens),
 * this follows the exact same guard `SandboxTransactionService` uses:
 * blocked outright when `NODE_ENV === 'production'`, description always
 * prefixed, API response always carries `sandbox: true`. The ledger
 * mechanics mirror a withdrawal (debit the customer, credit the bank's
 * own Cash account) since, from the bank's own books, funds "leaving" to
 * an external party is exactly that — the difference from
 * `SandboxTransactionService.withdraw` is only that this is tied to a
 * named, saved beneficiary and modeled as `TRANSFER_EXTERNAL`.
 *
 * Milestone 2 security phase: same `TransferRiskService` gate as
 * `InternalTransferService` — see that class's doc comment for the
 * MFA-step-up / held-for-review shape. Money leaving to someone else is,
 * if anything, the more important place to have this than an internal
 * transfer, so it isn't skipped here even though the settlement itself is
 * already simulated.
 */
@Injectable()
export class ExternalTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: AccountNotificationService,
    private readonly limitsService: TransferLimitsService,
    private readonly riskService: TransferRiskService,
    private readonly ledgerPostingService: LedgerPostingService,
    private readonly beneficiariesService: BeneficiariesService,
    private readonly configService: ConfigService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
    @Inject(RECEIPTS_QUEUE) private readonly receiptsQueue: QueuePort<ReceiptJobPayload>,
  ) {}

  async transfer(
    userId: string,
    sourceAccountId: string,
    wireDetails: WireBeneficiaryDetails,
    amount: number,
    description: string | undefined,
    mfaCode?: string,
    deviceId?: string,
  ): Promise<TransferResponseDto> {
    this.assertSandboxEnabled();

    const account = await this.loadOwnedActiveAccount(userId, sourceAccountId);
    const beneficiary = await this.beneficiariesService.findOrCreateForWire(userId, wireDetails);

    if (beneficiary.currencyId !== account.currencyId) {
      throw new BadRequestException('The beneficiary currency does not match the source account currency');
    }

    const balance = await this.prisma.accountBalance.findUniqueOrThrow({ where: { accountId: sourceAccountId } });
    if (!account.accountType.allowsOverdraft && Number(balance.availableBalance) < amount) {
      throw new BadRequestException('Insufficient available balance for this transfer');
    }

    await this.limitsService.assertWithinLimits({
      customerId: account.customerId,
      accountId: sourceAccountId,
      kycTier: account.customer.tier,
      currencyId: account.currencyId,
      amount,
    });

    const { hold: holdForReview, signals: holdSignals } = await this.resolveStepUp(
      userId,
      deviceId,
      amount,
      account.currency.isoCode,
      mfaCode,
    );

    const transferType = await this.prisma.transactionType.findUniqueOrThrow({ where: { code: 'TRANSFER_EXTERNAL' } });
    const reference = await this.generateTransactionReference();
    const label = `[SIMULATED SETTLEMENT] ${description?.trim() || `Transfer to ${beneficiary.beneficiaryName}`}`;

    if (holdForReview) {
      const held = await this.prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            transactionReference: reference,
            transactionTypeId: transferType.id,
            sourceAccountId,
            amount,
            currencyId: account.currencyId,
            status: 'PENDING',
            initiatedBy: userId,
            description: label,
            metadata: { fraudSignals: holdSignals } as unknown as Prisma.InputJsonValue,
          },
        });
        const transferRequest = await tx.transferRequest.create({
          data: {
            transactionId: transaction.id,
            transferChannel: 'EXTERNAL_ACH',
            sourceAccountId,
            destinationBeneficiaryId: beneficiary.id,
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
        afterState: { amount, direction: 'TRANSFER_EXTERNAL', sourceAccountId, beneficiaryId: beneficiary.id, status: 'PENDING' },
      });

      const heldCustomer = await this.prisma.customer.findUniqueOrThrow({
        where: { id: account.customerId },
        include: { user: { include: { profile: true } } },
      });
      await this.notificationService.sendEmail({
        customerId: account.customerId,
        toAddress: heldCustomer.user.email,
        templateCode: 'TRANSFER_INITIATED_EMAIL',
        variables: {
          firstName: heldCustomer.user.profile?.firstName ?? 'there',
          amount: amount.toFixed(2),
          currencyCode: account.currency.isoCode,
          sourceAccountNumber: account.accountNumber,
          destinationAccountNumber: `${beneficiary.beneficiaryName} (${beneficiary.accountNumber})`,
          transactionReference: reference,
          portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
          year: String(new Date().getFullYear()),
        },
      });

      return this.toResponseDto(held, account.currency.isoCode);
    }

    const cashLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { code: CASH_LEDGER_ACCOUNT_CODE } });
    const customerLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: sourceAccountId } });

    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          transactionReference: reference,
          transactionTypeId: transferType.id,
          sourceAccountId,
          amount,
          currencyId: account.currencyId,
          status: 'PROCESSING',
          initiatedBy: userId,
          description: label,
        },
      });

      await tx.transferRequest.create({
        data: {
          transactionId: transaction.id,
          transferChannel: 'EXTERNAL_ACH',
          sourceAccountId,
          destinationBeneficiaryId: beneficiary.id,
          requestedAmount: amount,
          narrative: label,
        },
      });

      const { journalEntryId } = await this.ledgerPostingService.postExternalTransfer(tx, {
        transactionId: transaction.id,
        sourceAccountId,
        sourceLedgerAccountId: customerLedgerAccount.id,
        cashLedgerAccountId: cashLedgerAccount.id,
        amount,
        currencyId: account.currencyId,
        description: label,
      });

      const completed = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      return { transaction: completed, journalEntryId };
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
      afterState: { amount, direction: 'TRANSFER_EXTERNAL', sourceAccountId, beneficiaryId: beneficiary.id },
    });

    await this.receiptsQueue.enqueue({ transactionId: result.transaction.id, format: 'JSON' });

    const customerWithUser = await this.prisma.customer.findUniqueOrThrow({
      where: { id: account.customerId },
      include: { user: { include: { profile: true } } },
    });
    await this.notificationService.sendEmail({
      customerId: account.customerId,
      toAddress: customerWithUser.user.email,
      templateCode: 'TRANSFER_COMPLETED_EMAIL',
      variables: {
        firstName: customerWithUser.user.profile?.firstName ?? 'there',
        amount: amount.toFixed(2),
        currencyCode: account.currency.isoCode,
        sourceAccountNumber: account.accountNumber,
        destinationAccountNumber: `${beneficiary.beneficiaryName} (${beneficiary.accountNumber})`,
        transactionReference: reference,
        portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
        year: String(new Date().getFullYear()),
      },
    });

    const largeTransferThreshold = await resolveHighValueTransferThreshold(this.prisma);
    if (amount >= largeTransferThreshold) {
      await this.notificationService.sendEmail({
        customerId: account.customerId,
        toAddress: customerWithUser.user.email,
        templateCode: 'LARGE_TRANSFER_ALERT_EMAIL',
        priority: 'HIGH',
        variables: {
          firstName: customerWithUser.user.profile?.firstName ?? 'there',
          amount: amount.toFixed(2),
          currencyCode: account.currency.isoCode,
          sourceAccountNumber: account.accountNumber,
          destinationAccountNumber: `${beneficiary.beneficiaryName} (${beneficiary.accountNumber})`,
          transactionReference: reference,
          portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
          year: String(new Date().getFullYear()),
        },
      });
    }

    return this.toResponseDto(result.transaction, account.currency.isoCode);
  }

  /**
   * Returns `hold: true` (plus the triggered `FraudSignal[]`, so the hold
   * carries a reason a reviewer can actually see) if the transfer must wait
   * for manual review (risk-flagged, no MFA available to step up with).
   * Throws `MfaRequiredException`/`BadRequestException` for the other two
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

  private assertSandboxEnabled(): void {
    if (this.configService.get<string>('nodeEnv') === 'production') {
      throw new ForbiddenException(
        'External transfers are simulated settlement only in this deployment — no licensed payment rail is connected, so this feature is disabled outside development',
      );
    }
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
      const candidate = `TRX${randomInt(100_000_000, 999_999_999)}`;
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
      transferType: 'TRANSFER_EXTERNAL',
      sourceAccountId: transaction.sourceAccountId ?? undefined,
      destinationAccountId: transaction.destinationAccountId ?? undefined,
      amount: String(transaction.amount),
      currencyCode,
      status: transaction.status,
      description: transaction.description ?? undefined,
      sandbox: true,
      createdAt: transaction.createdAt.toISOString(),
      completedAt: transaction.completedAt?.toISOString(),
    };
  }
}

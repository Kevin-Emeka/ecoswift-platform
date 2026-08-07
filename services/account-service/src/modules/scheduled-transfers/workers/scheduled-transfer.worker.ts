import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions, Job } from 'bullmq';
import { BaseWorker, BULLMQ_CONNECTION, QUEUE_NAMES, TRANSFERS_QUEUE } from '@ecoswift/queue';
import type { QueuePort, ScheduledTransferJobPayload } from '@ecoswift/queue';
import { PrismaService } from '@ecoswift/database';
import { InternalTransferService } from '../../transfers/services/internal-transfer.service';
import { ExternalTransferService } from '../../transfers/services/external-transfer.service';
import { AccountNotificationService } from '../../../common/services/account-notification.service';

const FREQUENCY_DAYS: Record<'DAILY' | 'WEEKLY' | 'MONTHLY', number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30, // Calendar-month accuracy isn't needed here — see addOccurrence's doc comment.
};

/**
 * Consumes `TRANSFERS_QUEUE`. Lives in `account-service` (unlike
 * `ReceiptWorker`/`EmailWorker`, which live in their own services) because
 * executing a scheduled transfer means directly calling
 * `InternalTransferService`/`ExternalTransferService` — the exact same
 * business logic a same-day transfer runs through. Putting the worker in a
 * separate service would mean either duplicating that logic or making an
 * HTTP call back into account-service for every occurrence; neither has
 * any benefit over co-locating it where the logic already lives.
 *
 * Idempotency: this worker never trusts that a job fires at most once. It
 * atomically claims the row (`UPDATE ... WHERE status = 'SCHEDULED'`)
 * before doing anything, so a duplicate delivery of the same BullMQ job —
 * or a job that fires after the customer cancelled — is a clean no-op
 * rather than a double-spend.
 */
@Injectable()
export class ScheduledTransferWorker extends BaseWorker<ScheduledTransferJobPayload> {
  protected readonly queueName = QUEUE_NAMES.TRANSFERS;
  private readonly workerLogger = new Logger(ScheduledTransferWorker.name);

  constructor(
    @Inject(BULLMQ_CONNECTION) connection: ConnectionOptions,
    private readonly prisma: PrismaService,
    private readonly internalTransferService: InternalTransferService,
    private readonly externalTransferService: ExternalTransferService,
    private readonly notificationService: AccountNotificationService,
    private readonly configService: ConfigService,
    @Inject(TRANSFERS_QUEUE) private readonly transfersQueue: QueuePort<ScheduledTransferJobPayload>,
  ) {
    super(connection);
  }

  protected async process(job: Job<ScheduledTransferJobPayload>): Promise<void> {
    const { scheduledTransferId } = job.data;

    const claim = await this.prisma.scheduledTransfer.updateMany({
      where: { id: scheduledTransferId, status: 'SCHEDULED' },
      data: { status: 'PROCESSING' },
    });
    if (claim.count === 0) {
      this.workerLogger.log(`Scheduled transfer ${scheduledTransferId} is no longer SCHEDULED (cancelled or already run) — skipping`);
      return;
    }

    const scheduledTransfer = await this.prisma.scheduledTransfer.findUniqueOrThrow({
      where: { id: scheduledTransferId },
      include: {
        sourceAccount: { include: { customer: { include: { user: { include: { profile: true } } } } } },
        currency: true,
      },
    });
    const userId = scheduledTransfer.sourceAccount.customer.userId;
    const label = scheduledTransfer.description ? `${scheduledTransfer.description} (scheduled)` : 'Scheduled transfer';

    try {
      if (scheduledTransfer.transferChannel === 'INTERNAL') {
        await this.internalTransferService.transfer(
          userId,
          scheduledTransfer.sourceAccountId,
          scheduledTransfer.destinationAccountId!,
          Number(scheduledTransfer.amount),
          label,
        );
      } else {
        // Scheduled external transfers still reference a saved Beneficiary
        // by id (created via the Beneficiaries page, or auto-saved by a
        // prior one-off wire) — same-day wires no longer require one (see
        // ExternalTransferService's doc comment), but a *scheduled*
        // transfer has to reference something stable to replay on each
        // occurrence, so this path is unchanged.
        const beneficiary = await this.prisma.beneficiary.findUniqueOrThrow({
          where: { id: scheduledTransfer.destinationBeneficiaryId! },
          include: { currency: true },
        });
        await this.externalTransferService.transfer(
          userId,
          scheduledTransfer.sourceAccountId,
          {
            beneficiaryName: beneficiary.beneficiaryName,
            accountNumber: beneficiary.accountNumber,
            bankName: beneficiary.bankName ?? undefined,
            swiftBic: beneficiary.swiftBic ?? undefined,
            bankAddress: beneficiary.bankAddress ?? undefined,
            bankCountryCode: beneficiary.bankCountryCode ?? undefined,
            routingNumber: beneficiary.routingNumber ?? undefined,
            currencyCode: beneficiary.currency.isoCode,
          },
          Number(scheduledTransfer.amount),
          label,
        );
      }

      await this.onOccurrenceSucceeded(scheduledTransfer);
    } catch (error) {
      // Deliberately not rethrown: a failure here is a business-rule
      // rejection (insufficient balance, limit exceeded, account frozen
      // since the schedule was created, etc.), not a transient
      // infrastructure error — BullMQ retrying the same failing transfer
      // wouldn't help and risks confusing repeated notification/audit
      // noise. The schedule just stops; the customer sees why in the UI
      // and can create a new one.
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.scheduledTransfer.update({
        where: { id: scheduledTransfer.id },
        data: { status: 'FAILED', failureReason: message, lastRunAt: new Date() },
      });
      this.workerLogger.warn(`Scheduled transfer ${scheduledTransfer.id} failed: ${message}`);

      await this.notificationService.sendEmail({
        customerId: scheduledTransfer.sourceAccount.customer.id,
        toAddress: scheduledTransfer.sourceAccount.customer.user.email,
        templateCode: 'TRANSFER_FAILED_EMAIL',
        variables: {
          firstName: scheduledTransfer.sourceAccount.customer.user.profile?.firstName ?? 'there',
          amount: Number(scheduledTransfer.amount).toFixed(2),
          currencyCode: scheduledTransfer.currency.isoCode,
          sourceAccountNumber: scheduledTransfer.sourceAccount.accountNumber,
          reason: message,
          portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
          year: String(new Date().getFullYear()),
        },
      });
    }
  }

  private async onOccurrenceSucceeded(scheduledTransfer: {
    id: string;
    frequency: string;
    nextRunAt: Date;
    endDate: Date | null;
  }): Promise<void> {
    const now = new Date();

    if (scheduledTransfer.frequency === 'ONE_TIME') {
      await this.prisma.scheduledTransfer.update({
        where: { id: scheduledTransfer.id },
        data: { status: 'COMPLETED', lastRunAt: now },
      });
      return;
    }

    const next = this.addOccurrence(scheduledTransfer.nextRunAt, scheduledTransfer.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY');
    if (scheduledTransfer.endDate && next.getTime() > scheduledTransfer.endDate.getTime()) {
      await this.prisma.scheduledTransfer.update({
        where: { id: scheduledTransfer.id },
        data: { status: 'COMPLETED', lastRunAt: now },
      });
      return;
    }

    await this.prisma.scheduledTransfer.update({
      where: { id: scheduledTransfer.id },
      data: { status: 'SCHEDULED', nextRunAt: next, lastRunAt: now },
    });

    await this.transfersQueue.enqueue(
      { scheduledTransferId: scheduledTransfer.id },
      { delayMs: Math.max(0, next.getTime() - Date.now()), jobId: `${scheduledTransfer.id}-${next.getTime()}` },
    );
  }

  /**
   * Calendar-day arithmetic, not "add N days in milliseconds" — the latter
   * drifts across DST transitions. MONTHLY is approximated as 30 days
   * rather than true calendar-month math (which has to decide what "Jan
   * 31 + 1 month" means); acceptable for this feature, not for something
   * like interest accrual.
   */
  private addOccurrence(from: Date, frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Date {
    const next = new Date(from);
    next.setDate(next.getDate() + FREQUENCY_DAYS[frequency]);
    return next;
  }
}

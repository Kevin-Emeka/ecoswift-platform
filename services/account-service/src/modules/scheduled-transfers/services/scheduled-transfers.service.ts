import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ecoswift/database';
import { TRANSFERS_QUEUE } from '@ecoswift/queue';
import type { QueuePort, ScheduledTransferJobPayload } from '@ecoswift/queue';
import { AuditService } from '../../../common/services/audit.service';
import { AccountNotificationService } from '../../../common/services/account-notification.service';
import type { CreateScheduledTransferDto, ScheduledTransferResponseDto } from '../dto/scheduled-transfer.dto';

@Injectable()
export class ScheduledTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: AccountNotificationService,
    private readonly configService: ConfigService,
    @Inject(TRANSFERS_QUEUE) private readonly transfersQueue: QueuePort<ScheduledTransferJobPayload>,
  ) {}

  async create(userId: string, sourceAccountId: string, dto: CreateScheduledTransferDto): Promise<ScheduledTransferResponseDto> {
    const sourceAccount = await this.loadOwnedActiveAccount(userId, sourceAccountId);

    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
      throw new BadRequestException('startAt must be a valid date in the future');
    }
    let endDate: Date | undefined;
    if (dto.endDate) {
      endDate = new Date(dto.endDate);
      if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= startAt.getTime()) {
        throw new BadRequestException('endDate must be after startAt');
      }
      if (dto.frequency === 'ONE_TIME') {
        throw new BadRequestException('endDate does not apply to a ONE_TIME transfer');
      }
    }

    let destinationAccountId: string | undefined;
    let destinationBeneficiaryId: string | undefined;

    if (dto.transferType === 'INTERNAL') {
      if (!dto.destinationAccountId) throw new BadRequestException('destinationAccountId is required for an INTERNAL schedule');
      const destinationAccount = await this.loadOwnedActiveAccount(userId, dto.destinationAccountId);
      if (destinationAccount.id === sourceAccount.id) {
        throw new BadRequestException('Source and destination accounts must be different');
      }
      if (destinationAccount.currencyId !== sourceAccount.currencyId) {
        throw new BadRequestException('Scheduled internal transfers between different currencies are not supported yet');
      }
      destinationAccountId = destinationAccount.id;
    } else {
      if (!dto.beneficiaryId) throw new BadRequestException('beneficiaryId is required for an EXTERNAL schedule');
      const beneficiary = await this.prisma.beneficiary.findUnique({ where: { id: dto.beneficiaryId }, include: { customer: true } });
      if (!beneficiary || beneficiary.deletedAt || beneficiary.customer.userId !== userId) {
        throw new NotFoundException('Beneficiary not found');
      }
      if (beneficiary.status !== 'ACTIVE') {
        throw new BadRequestException('This beneficiary must be verified before scheduling a transfer to it');
      }
      destinationBeneficiaryId = beneficiary.id;
    }

    const scheduledTransfer = await this.prisma.scheduledTransfer.create({
      data: {
        customerId: sourceAccount.customerId,
        sourceAccountId: sourceAccount.id,
        transferChannel: dto.transferType === 'INTERNAL' ? 'INTERNAL' : 'EXTERNAL_ACH',
        destinationAccountId,
        destinationBeneficiaryId,
        amount: dto.amount,
        currencyId: sourceAccount.currencyId,
        description: dto.description,
        frequency: dto.frequency,
        nextRunAt: startAt,
        endDate,
        status: 'SCHEDULED',
      },
      include: { currency: true, destinationBeneficiary: true },
    });

    try {
      await this.transfersQueue.enqueue(
        { scheduledTransferId: scheduledTransfer.id },
        { delayMs: startAt.getTime() - Date.now(), jobId: `${scheduledTransfer.id}-${startAt.getTime()}` },
      );
    } catch (error) {
      // The row and its delayed job must exist together or not at all —
      // a SCHEDULED row with no corresponding job would just sit there
      // forever, since nothing else ever re-checks it. Delete rather than
      // leave it orphaned, and surface the original queue error.
      await this.prisma.scheduledTransfer.delete({ where: { id: scheduledTransfer.id } });
      throw error;
    }

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'CREATE',
      resourceType: 'ScheduledTransfer',
      resourceId: scheduledTransfer.id,
      description: `Scheduled a ${dto.frequency.toLowerCase()} transfer of ${dto.amount}`,
      afterState: { amount: dto.amount, frequency: dto.frequency, nextRunAt: startAt.toISOString() },
    });

    return this.toResponseDto(scheduledTransfer);
  }

  async list(userId: string): Promise<ScheduledTransferResponseDto[]> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const rows = await this.prisma.scheduledTransfer.findMany({
      where: { customerId: customer.id },
      include: { currency: true, destinationBeneficiary: true },
      orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }],
    });
    return rows.map((r) => this.toResponseDto(r));
  }

  async cancel(userId: string, scheduledTransferId: string): Promise<void> {
    const scheduledTransfer = await this.prisma.scheduledTransfer.findUnique({
      where: { id: scheduledTransferId },
      include: {
        customer: { include: { user: { include: { profile: true } } } },
        sourceAccount: true,
        destinationAccount: true,
        destinationBeneficiary: true,
        currency: true,
      },
    });
    if (!scheduledTransfer || scheduledTransfer.customer.userId !== userId) {
      throw new NotFoundException('Scheduled transfer not found');
    }
    if (scheduledTransfer.status !== 'SCHEDULED') {
      throw new BadRequestException(`Only a SCHEDULED transfer can be cancelled (current status: ${scheduledTransfer.status})`);
    }

    // No need to also remove the delayed BullMQ job — ScheduledTransferWorker
    // re-checks status === SCHEDULED before doing anything, so a job that
    // fires after this update is simply a no-op. Simpler and race-free
    // compared to trying to pull the job back out of BullMQ.
    await this.prisma.scheduledTransfer.update({
      where: { id: scheduledTransfer.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'UPDATE',
      resourceType: 'ScheduledTransfer',
      resourceId: scheduledTransfer.id,
      description: 'Cancelled a scheduled transfer',
      beforeState: { status: 'SCHEDULED' },
      afterState: { status: 'CANCELLED' },
    });

    const destinationLabel = scheduledTransfer.destinationAccount
      ? `account ${scheduledTransfer.destinationAccount.accountNumber}`
      : `${scheduledTransfer.destinationBeneficiary!.beneficiaryName} (${scheduledTransfer.destinationBeneficiary!.accountNumber})`;
    await this.notificationService.sendEmail({
      customerId: scheduledTransfer.customerId,
      toAddress: scheduledTransfer.customer.user.email,
      templateCode: 'TRANSFER_CANCELLED_EMAIL',
      variables: {
        firstName: scheduledTransfer.customer.user.profile?.firstName ?? 'there',
        amount: Number(scheduledTransfer.amount).toFixed(2),
        currencyCode: scheduledTransfer.currency.isoCode,
        sourceAccountNumber: scheduledTransfer.sourceAccount.accountNumber,
        destinationLabel,
        frequency: scheduledTransfer.frequency.toLowerCase().replace('_', '-'),
        portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
        year: String(new Date().getFullYear()),
      },
    });
  }

  private async loadOwnedActiveAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { customer: true, currency: true },
    });
    if (!account || account.customer.userId !== userId) {
      throw new NotFoundException('Account not found');
    }
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException(`Account must be ACTIVE to schedule transfers (current status: ${account.status})`);
    }
    return account;
  }

  private toResponseDto(row: {
    id: string;
    sourceAccountId: string;
    transferChannel: string;
    destinationAccountId: string | null;
    destinationBeneficiaryId: string | null;
    destinationBeneficiary: { beneficiaryName: string } | null;
    amount: unknown;
    currency: { isoCode: string };
    description: string | null;
    frequency: string;
    nextRunAt: Date;
    endDate: Date | null;
    status: string;
    lastRunAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
  }): ScheduledTransferResponseDto {
    return {
      id: row.id,
      sourceAccountId: row.sourceAccountId,
      transferType: row.transferChannel === 'INTERNAL' ? 'INTERNAL' : 'EXTERNAL',
      destinationAccountId: row.destinationAccountId ?? undefined,
      beneficiaryId: row.destinationBeneficiaryId ?? undefined,
      beneficiaryName: row.destinationBeneficiary?.beneficiaryName ?? undefined,
      amount: String(row.amount),
      currencyCode: row.currency.isoCode,
      description: row.description ?? undefined,
      frequency: row.frequency,
      nextRunAt: row.nextRunAt.toISOString(),
      endDate: row.endDate?.toISOString(),
      status: row.status,
      lastRunAt: row.lastRunAt?.toISOString(),
      failureReason: row.failureReason ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

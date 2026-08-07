import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';

/**
 * Enforces the daily/per-transaction/monthly ceilings the milestone 2
 * brief calls "configurable limits... admin configurable". Resolution
 * order for which `TransferLimit` row applies to a given transfer:
 * account-specific > customer-specific > KYC-tier > the single
 * platform-wide default row (customerId/accountId/tier all null, seeded
 * in prisma/seed.ts). Admins adjust limits by editing/inserting
 * `TransferLimit` rows scoped however they choose — this service just
 * resolves and enforces whatever is in effect.
 */
@Injectable()
export class TransferLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertWithinLimits(params: {
    customerId: string;
    accountId: string;
    kycTier: 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';
    currencyId: string;
    amount: number;
  }): Promise<void> {
    const limit = await this.resolveLimit(params.customerId, params.accountId, params.kycTier, params.currencyId);
    if (!limit) return; // No limit configured anywhere, including no default — nothing to enforce.

    if (params.amount > Number(limit.perTransactionLimit)) {
      throw new BadRequestException(
        `Transfer amount exceeds the per-transaction limit of ${limit.perTransactionLimit}`,
      );
    }

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [dayTotal, monthTotal] = await Promise.all([
      this.sumOutboundTransfers(params.accountId, dayStart),
      this.sumOutboundTransfers(params.accountId, monthStart),
    ]);

    if (dayTotal + params.amount > Number(limit.dailyLimit)) {
      throw new BadRequestException(`This transfer would exceed your daily transfer limit of ${limit.dailyLimit}`);
    }
    if (monthTotal + params.amount > Number(limit.monthlyLimit)) {
      throw new BadRequestException(`This transfer would exceed your monthly transfer limit of ${limit.monthlyLimit}`);
    }
  }

  private async resolveLimit(customerId: string, accountId: string, tier: string, currencyId: string) {
    const accountScoped = await this.prisma.transferLimit.findFirst({
      where: { accountId, currencyId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (accountScoped) return accountScoped;

    const customerScoped = await this.prisma.transferLimit.findFirst({
      where: { customerId, accountId: null, currencyId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (customerScoped) return customerScoped;

    const tierScoped = await this.prisma.transferLimit.findFirst({
      where: { tier: tier as never, customerId: null, accountId: null, currencyId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (tierScoped) return tierScoped;

    return this.prisma.transferLimit.findFirst({
      where: { customerId: null, accountId: null, tier: null, currencyId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /** Sum of completed outbound transfers from this account since `since`, for velocity/limit checks. */
  private async sumOutboundTransfers(accountId: string, since: Date): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        sourceAccountId: accountId,
        status: 'COMPLETED',
        createdAt: { gte: since },
        transactionType: { code: { in: ['TRANSFER_INTERNAL', 'TRANSFER_EXTERNAL'] } },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}

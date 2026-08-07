import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';
import { AuditService } from '../../../common/services/audit.service';
import type { CreateTransferLimitDto, TransferLimitResponseDto, TransferLimitScope } from '../dto/transfer-limit.dto';

const limitInclude = {
  currency: true,
  customer: { include: { user: { include: { profile: true } } } },
  account: true,
} satisfies Prisma.TransferLimitInclude;

type LimitRow = Prisma.TransferLimitGetPayload<{ include: typeof limitInclude }>;

/**
 * Staff-facing management of `TransferLimit` — the admin-configurable
 * daily/per-transaction/monthly ceilings `TransferLimitsService` enforces
 * (account > customer > tier > global precedence, see that service's doc
 * comment). Every write here is additive, never a destructive overwrite:
 * setting a new limit for a scope retires the previous active row
 * (`effectiveTo = now()`) rather than deleting it, so the effective-dated
 * history stays intact for audit purposes — the same pattern
 * `TransferLimitsService.resolveLimit` already relies on
 * (`orderBy: effectiveFrom desc`, `effectiveTo: null` = currently active).
 */
@Injectable()
export class TransferLimitsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(): Promise<TransferLimitResponseDto[]> {
    const rows = await this.prisma.transferLimit.findMany({
      where: { effectiveTo: null },
      include: limitInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(staffUserId: string, dto: CreateTransferLimitDto): Promise<TransferLimitResponseDto> {
    const currency = await this.prisma.currency.findUnique({ where: { isoCode: dto.currencyCode.toUpperCase() } });
    if (!currency) throw new BadRequestException(`Unknown currency code "${dto.currencyCode}"`);

    if (dto.scope === 'CUSTOMER') {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    if (dto.scope === 'ACCOUNT') {
      const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
      if (!account) throw new NotFoundException('Account not found');
    }

    // Mirrors the DB-level CHECK constraint (transfer_limits_ordering_valid:
    // per_transaction_limit <= daily_limit <= monthly_limit) so a caller
    // gets a clear 400 with a specific message instead of a raw, opaque
    // PrismaClientUnknownRequestError surfacing as a 500.
    if (dto.perTransactionLimit > dto.dailyLimit) {
      throw new BadRequestException('Per-transaction limit cannot be greater than the daily limit');
    }
    if (dto.dailyLimit > dto.monthlyLimit) {
      throw new BadRequestException('Daily limit cannot be greater than the monthly limit');
    }

    const scopeWhere = this.scopeWhere(dto.scope, dto, currency.id);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.transferLimit.updateMany({
        where: { ...scopeWhere, effectiveTo: null },
        data: { effectiveTo: new Date() },
      });
      return tx.transferLimit.create({
        data: {
          tier: dto.scope === 'TIER' ? dto.tier : undefined,
          customerId: dto.scope === 'CUSTOMER' ? dto.customerId : undefined,
          accountId: dto.scope === 'ACCOUNT' ? dto.accountId : undefined,
          currencyId: currency.id,
          dailyLimit: dto.dailyLimit,
          perTransactionLimit: dto.perTransactionLimit,
          monthlyLimit: dto.monthlyLimit,
        },
        include: limitInclude,
      });
    });

    await this.auditService.record({
      actorUserId: staffUserId,
      actorType: 'STAFF',
      actionType: 'UPDATE',
      resourceType: 'TransferLimit',
      resourceId: created.id,
      description: `Set ${dto.scope.toLowerCase()} transfer limit (${dto.currencyCode})`,
      afterState: {
        scope: dto.scope,
        tier: dto.tier,
        customerId: dto.customerId,
        accountId: dto.accountId,
        dailyLimit: dto.dailyLimit,
        perTransactionLimit: dto.perTransactionLimit,
        monthlyLimit: dto.monthlyLimit,
      },
    });

    return this.toDto(created);
  }

  async retire(staffUserId: string, id: string): Promise<void> {
    const existing = await this.prisma.transferLimit.findUnique({ where: { id } });
    if (!existing || existing.effectiveTo) {
      throw new NotFoundException('No active transfer limit found for this id');
    }
    if (!existing.customerId && !existing.accountId && !existing.tier) {
      throw new BadRequestException('The global default limit cannot be removed — replace it with a new one instead');
    }

    await this.prisma.transferLimit.update({ where: { id }, data: { effectiveTo: new Date() } });

    await this.auditService.record({
      actorUserId: staffUserId,
      actorType: 'STAFF',
      actionType: 'DELETE',
      resourceType: 'TransferLimit',
      resourceId: id,
      description: 'Removed a scoped transfer limit override',
      beforeState: {
        tier: existing.tier,
        customerId: existing.customerId,
        accountId: existing.accountId,
      },
    });
  }

  private scopeWhere(
    scope: TransferLimitScope,
    dto: CreateTransferLimitDto,
    currencyId: string,
  ): Prisma.TransferLimitWhereInput {
    switch (scope) {
      case 'GLOBAL':
        return { customerId: null, accountId: null, tier: null, currencyId };
      case 'TIER':
        return { tier: dto.tier, customerId: null, accountId: null, currencyId };
      case 'CUSTOMER':
        return { customerId: dto.customerId, accountId: null, currencyId };
      case 'ACCOUNT':
        return { accountId: dto.accountId, currencyId };
    }
  }

  private toDto(row: LimitRow): TransferLimitResponseDto {
    const scope: TransferLimitScope = row.accountId ? 'ACCOUNT' : row.customerId ? 'CUSTOMER' : row.tier ? 'TIER' : 'GLOBAL';
    const profile = row.customer?.user.profile;
    return {
      id: row.id,
      scope,
      tier: row.tier ?? undefined,
      customerId: row.customerId ?? undefined,
      customerName: profile ? `${profile.firstName} ${profile.lastName}` : row.customer?.user.email,
      accountId: row.accountId ?? undefined,
      accountNumber: row.account?.accountNumber,
      currencyCode: row.currency.isoCode,
      dailyLimit: String(row.dailyLimit),
      perTransactionLimit: String(row.perTransactionLimit),
      monthlyLimit: String(row.monthlyLimit),
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo?.toISOString(),
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';
import type { ListAccountsQueryDto } from '../dto/list-query.dto';
import type { AccountSummaryDto, PaginatedAccountSummary } from '../dto/staff-summary-response.dto';

/**
 * Staff-facing "browse any account" surface (`accounts:list`) — distinct
 * from the self-service `GET /v1/accounts` in `AccountsController`, which
 * is always scoped to the caller's own accounts. Used by the admin
 * panel's Account Management screen.
 */
@Injectable()
export class StaffAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAccountsQueryDto): Promise<PaginatedAccountSummary> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AccountWhereInput = {
      status: query.status as Prisma.AccountWhereInput['status'],
      ...(query.search ? { accountNumber: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [total, accounts] = await Promise.all([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: { customer: true, accountType: true, currency: true, balance: true },
      }),
    ]);

    const items: AccountSummaryDto[] = accounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      customerId: account.customerId,
      customerNumber: account.customer.customerNumber,
      accountTypeCode: account.accountType.code,
      currencyCode: account.currency.isoCode,
      status: account.status,
      availableBalance: (account.balance?.availableBalance ?? 0).toString(),
      openedAt: account.openedAt.toISOString(),
    }));

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getById(accountId: string): Promise<AccountSummaryDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { customer: true, accountType: true, currency: true, balance: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return {
      id: account.id,
      accountNumber: account.accountNumber,
      customerId: account.customerId,
      customerNumber: account.customer.customerNumber,
      accountTypeCode: account.accountType.code,
      currencyCode: account.currency.isoCode,
      status: account.status,
      availableBalance: (account.balance?.availableBalance ?? 0).toString(),
      openedAt: account.openedAt.toISOString(),
    };
  }
}

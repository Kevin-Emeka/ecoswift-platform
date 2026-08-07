import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { TransactionResponseDto } from '../dto/transaction-response.dto';

/** Transaction types that never move real, non-fabricated money — see `SandboxTransactionService` and `ExternalTransferService`. Internal transfers are the only money-movement type that's real within this platform's own ledger. */
const SANDBOX_TYPE_CODES = new Set(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_EXTERNAL']);

@Injectable()
export class TransactionQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAccount(userId: string, accountId: string): Promise<TransactionResponseDto[]> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, include: { customer: true, currency: true } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.customer.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resource');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }] },
      orderBy: { createdAt: 'desc' },
      include: { currency: true, transactionType: true },
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      transactionReference: transaction.transactionReference,
      transactionType: transaction.transactionType.code,
      sourceAccountId: transaction.sourceAccountId ?? undefined,
      destinationAccountId: transaction.destinationAccountId ?? undefined,
      amount: String(transaction.amount),
      currencyCode: transaction.currency.isoCode,
      status: transaction.status,
      description: transaction.description ?? undefined,
      sandbox: SANDBOX_TYPE_CODES.has(transaction.transactionType.code),
      createdAt: transaction.createdAt.toISOString(),
      completedAt: transaction.completedAt?.toISOString(),
    }));
  }
}

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransactionQueryService } from './transaction-query.service';
import type { PrismaService } from '@ecoswift/database';

describe('TransactionQueryService', () => {
  let prisma: { account: { findUnique: jest.Mock }; transaction: { findMany: jest.Mock } };
  let service: TransactionQueryService;

  beforeEach(() => {
    prisma = { account: { findUnique: jest.fn() }, transaction: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new TransactionQueryService(prisma as unknown as PrismaService);
  });

  it('404s when the account does not exist', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    await expect(service.listForAccount('user-1', 'account-1')).rejects.toThrow(NotFoundException);
  });

  it('403s when the account belongs to someone else', async () => {
    prisma.account.findUnique.mockResolvedValue({ customer: { userId: 'someone-else' }, currency: { isoCode: 'USD' } });
    await expect(service.listForAccount('user-1', 'account-1')).rejects.toThrow(ForbiddenException);
  });

  it('classifies a transaction with no sourceAccountId as a DEPOSIT and one with no destinationAccountId as a WITHDRAWAL', async () => {
    prisma.account.findUnique.mockResolvedValue({ customer: { userId: 'user-1' }, currency: { isoCode: 'USD' } });
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'txn-1',
        transactionReference: 'TXN1',
        sourceAccountId: null,
        destinationAccountId: 'account-1',
        amount: 100,
        status: 'COMPLETED',
        description: null,
        createdAt: new Date(),
        completedAt: new Date(),
        currency: { isoCode: 'USD' },
      },
      {
        id: 'txn-2',
        transactionReference: 'TXN2',
        sourceAccountId: 'account-1',
        destinationAccountId: null,
        amount: 50,
        status: 'COMPLETED',
        description: null,
        createdAt: new Date(),
        completedAt: new Date(),
        currency: { isoCode: 'USD' },
      },
    ]);

    const result = await service.listForAccount('user-1', 'account-1');
    expect(result[0]!.transactionType).toBe('DEPOSIT');
    expect(result[1]!.transactionType).toBe('WITHDRAWAL');
    expect(result.every((r) => r.sandbox)).toBe(true);
  });
});

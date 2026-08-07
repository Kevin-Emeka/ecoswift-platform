import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReceiptQueryService } from './receipt-query.service';
import type { PrismaService } from '@ecoswift/database';

describe('ReceiptQueryService', () => {
  let prisma: { transaction: { findUnique: jest.Mock }; receipt: { findFirst: jest.Mock } };
  let service: ReceiptQueryService;

  beforeEach(() => {
    prisma = { transaction: { findUnique: jest.fn() }, receipt: { findFirst: jest.fn() } };
    service = new ReceiptQueryService(prisma as unknown as PrismaService);
  });

  it('404s when the transaction does not exist', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);
    await expect(service.getByTransactionId('user-1', 'txn-1')).rejects.toThrow(NotFoundException);
  });

  it('403s when the caller owns neither the source nor destination account', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      sourceAccount: { customer: { userId: 'someone-else' } },
      destinationAccount: null,
    });
    await expect(service.getByTransactionId('user-1', 'txn-1')).rejects.toThrow(ForbiddenException);
  });

  it('allows access when the caller owns the destination account (a deposit)', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      sourceAccount: null,
      destinationAccount: { customer: { userId: 'user-1' } },
    });
    prisma.receipt.findFirst.mockResolvedValue({
      id: 'receipt-1',
      referenceNumber: 'RCT123',
      format: 'JSON',
      content: { sandbox: true },
      generatedAt: new Date(),
    });

    const result = await service.getByTransactionId('user-1', 'txn-1');
    expect(result.referenceNumber).toBe('RCT123');
  });

  it('404s when no receipt has been generated yet for an otherwise-accessible transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      sourceAccount: { customer: { userId: 'user-1' } },
      destinationAccount: null,
    });
    prisma.receipt.findFirst.mockResolvedValue(null);
    await expect(service.getByTransactionId('user-1', 'txn-1')).rejects.toThrow(NotFoundException);
  });
});

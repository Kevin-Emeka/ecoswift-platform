import { ReceiptGeneratorService } from './receipt-generator.service';
import type { PrismaService } from '@ecoswift/database';

describe('ReceiptGeneratorService', () => {
  let prisma: { transaction: { findUnique: jest.Mock }; receipt: { findUnique: jest.Mock; create: jest.Mock } };
  let service: ReceiptGeneratorService;

  beforeEach(() => {
    prisma = {
      transaction: { findUnique: jest.fn() },
      receipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    service = new ReceiptGeneratorService(prisma as unknown as PrismaService);
  });

  it('does nothing (no throw) when the transaction does not exist', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);
    await expect(service.generate('missing-txn')).resolves.toBeUndefined();
    expect(prisma.receipt.create).not.toHaveBeenCalled();
  });

  it('builds a JSON receipt snapshot with sandbox: true and persists it', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'txn-1',
      transactionReference: 'TXN123',
      status: 'COMPLETED',
      amount: { toString: () => '100' },
      description: '[SANDBOX] test',
      createdAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-01'),
      transactionType: { code: 'DEPOSIT' },
      currency: { isoCode: 'USD' },
      sourceAccount: null,
      destinationAccount: {
        accountNumber: '1019318292',
        customer: { user: { profile: { firstName: 'Ada', lastName: 'Lovelace' } } },
      },
    });

    await service.generate('txn-1');

    expect(prisma.receipt.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.receipt.create.mock.calls[0][0];
    expect(createArgs.data.format).toBe('JSON');
    expect(createArgs.data.transactionId).toBe('txn-1');
    expect(createArgs.data.referenceNumber).toMatch(/^RCT\d{9}$/);
    expect(createArgs.data.content).toEqual(
      expect.objectContaining({
        transactionReference: 'TXN123',
        destinationAccountNumber: '1019318292',
        accountHolderName: 'Ada Lovelace',
        sandbox: true,
      }),
    );
  });

  it('retries reference-number generation on collision', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'txn-1',
      transactionReference: 'TXN123',
      status: 'COMPLETED',
      amount: { toString: () => '100' },
      description: null,
      createdAt: new Date(),
      completedAt: new Date(),
      transactionType: { code: 'DEPOSIT' },
      currency: { isoCode: 'USD' },
      sourceAccount: null,
      destinationAccount: null,
    });
    prisma.receipt.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);

    await service.generate('txn-1');
    expect(prisma.receipt.findUnique).toHaveBeenCalledTimes(2);
  });
});

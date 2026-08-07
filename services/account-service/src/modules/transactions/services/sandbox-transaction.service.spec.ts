import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxTransactionService } from './sandbox-transaction.service';
import type { PrismaService } from '@ecoswift/database';
import type { AuditService } from '../../../common/services/audit.service';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { QueuePort, ReceiptJobPayload } from '@ecoswift/queue';

describe('SandboxTransactionService', () => {
  let prisma: {
    account: { findUnique: jest.Mock };
    accountBalance: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    transactionType: { findUniqueOrThrow: jest.Mock };
    ledgerAccount: { findUniqueOrThrow: jest.Mock };
    financialPeriod: { findUnique: jest.Mock; create: jest.Mock };
    transaction: { create: jest.Mock; findUnique: jest.Mock };
    journalEntry: { create: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;
  let configService: { get: jest.Mock };
  let eventPublisher: { publish: jest.Mock };
  let receiptsQueue: jest.Mocked<Pick<QueuePort<ReceiptJobPayload>, 'enqueue'>>;
  let service: SandboxTransactionService;

  const account = {
    id: 'account-1',
    customerId: 'customer-1',
    currencyId: 'usd-id',
    status: 'ACTIVE',
    customer: { userId: 'user-1' },
    currency: { isoCode: 'USD' },
    accountType: { allowsOverdraft: false },
  };

  beforeEach(() => {
    prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(account) },
      accountBalance: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ availableBalance: 1000 }),
        update: jest.fn().mockResolvedValue({}),
      },
      transactionType: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'type-1' }) },
      ledgerAccount: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
      financialPeriod: {
        findUnique: jest.fn().mockResolvedValue({ id: 'period-1', status: 'OPEN' }),
        create: jest.fn(),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({
          id: 'txn-1',
          transactionReference: 'TXN123456789',
          sourceAccountId: null,
          destinationAccountId: 'account-1',
          amount: 100,
          status: 'COMPLETED',
          description: '[SANDBOX] test',
          createdAt: new Date(),
          completedAt: new Date(),
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({
          id: 'je-1',
          lines: [
            { id: 'line-debit', ledgerAccountId: 'cash-ledger', direction: 'DEBIT' },
            { id: 'line-credit', ledgerAccountId: 'ledger-1', direction: 'CREDIT' },
          ],
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue('development') };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    receiptsQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };

    service = new SandboxTransactionService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      configService as unknown as ConfigService,
      eventPublisher as unknown as EventPublisherPort,
      receiptsQueue as unknown as QueuePort<ReceiptJobPayload>,
    );
  });

  describe('deposit', () => {
    it('refuses to run when NODE_ENV is production', async () => {
      configService.get.mockReturnValue('production');
      await expect(service.deposit('user-1', 'account-1', 100, undefined)).rejects.toThrow(ForbiddenException);
    });

    it('404s when the account does not belong to the caller', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...account, customer: { userId: 'someone-else' } });
      await expect(service.deposit('user-1', 'account-1', 100, undefined)).rejects.toThrow(NotFoundException);
    });

    it('rejects a deposit into a non-ACTIVE account', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...account, status: 'FROZEN' });
      await expect(service.deposit('user-1', 'account-1', 100, undefined)).rejects.toThrow(BadRequestException);
    });

    it('creates a transaction, posts a balanced journal entry, publishes DEPOSIT_POSTED, audits, and enqueues a receipt job', async () => {
      const result = await service.deposit('user-1', 'account-1', 100, 'Test deposit');

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ destinationAccountId: 'account-1', amount: 100, status: 'COMPLETED' }) }),
      );
      const journalCreateArgs = prisma.journalEntry.create.mock.calls[0][0];
      expect(journalCreateArgs.data.lines.create).toHaveLength(2);
      expect(journalCreateArgs.data.lines.create[0]).toEqual(expect.objectContaining({ direction: 'DEBIT', amount: 100 }));
      expect(journalCreateArgs.data.lines.create[1]).toEqual(expect.objectContaining({ direction: 'CREDIT', amount: 100 }));

      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ledger.deposit_posted' }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'CREATE', resourceType: 'Transaction' }));
      expect(receiptsQueue.enqueue).toHaveBeenCalledWith({ transactionId: 'txn-1', format: 'JSON' });
      expect(result.sandbox).toBe(true);
      expect(result.description).toContain('[SANDBOX]');
    });
  });

  describe('withdraw', () => {
    it('rejects a withdrawal exceeding the available balance when overdraft is not allowed', async () => {
      prisma.accountBalance.findUniqueOrThrow.mockResolvedValue({ availableBalance: 10 });
      await expect(service.withdraw('user-1', 'account-1', 100, undefined)).rejects.toThrow(BadRequestException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('allows a withdrawal exceeding the balance when the account type allows overdraft', async () => {
      prisma.accountBalance.findUniqueOrThrow.mockResolvedValue({ availableBalance: 10 });
      prisma.account.findUnique.mockResolvedValue({ ...account, accountType: { allowsOverdraft: true } });
      prisma.transaction.create.mockResolvedValue({
        id: 'txn-2',
        transactionReference: 'TXN999999999',
        sourceAccountId: 'account-1',
        destinationAccountId: null,
        amount: 100,
        status: 'COMPLETED',
        description: '[SANDBOX] test',
        createdAt: new Date(),
        completedAt: new Date(),
      });
      prisma.journalEntry.create.mockResolvedValue({
        id: 'je-2',
        lines: [
          { id: 'line-debit', ledgerAccountId: 'ledger-1', direction: 'DEBIT' },
          { id: 'line-credit', ledgerAccountId: 'cash-ledger', direction: 'CREDIT' },
        ],
      });

      const result = await service.withdraw('user-1', 'account-1', 100, undefined);
      expect(result.transactionType).toBe('WITHDRAWAL');
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ledger.withdrawal_posted' }));
    });
  });
});

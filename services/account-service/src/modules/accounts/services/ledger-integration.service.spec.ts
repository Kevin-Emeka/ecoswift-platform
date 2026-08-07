import { InternalServerErrorException } from '@nestjs/common';
import { LedgerIntegrationService } from './ledger-integration.service';
import type { Prisma } from '@ecoswift/database';

describe('LedgerIntegrationService', () => {
  let tx: {
    accountCategory: { findUniqueOrThrow: jest.Mock };
    ledgerAccount: { create: jest.Mock; findUniqueOrThrow: jest.Mock };
    accountBalance: { create: jest.Mock; update: jest.Mock };
    financialPeriod: { findUnique: jest.Mock; create: jest.Mock };
    journalEntry: { create: jest.Mock; findUnique: jest.Mock };
  };
  let service: LedgerIntegrationService;

  beforeEach(() => {
    tx = {
      accountCategory: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'liability-cat' }) },
      ledgerAccount: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-acc-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'cash-ledger-acc' }),
      },
      accountBalance: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
      financialPeriod: { findUnique: jest.fn(), create: jest.fn() },
      journalEntry: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    };
    service = new LedgerIntegrationService();
  });

  describe('createCustomerLedgerAccount', () => {
    it('creates a LIABILITY-category ledger account linked to the customer account, and a zeroed balance', async () => {
      const result = await service.createCustomerLedgerAccount(tx as unknown as Prisma.TransactionClient, 'account-1', '1019318292', 'Savings — 1019318292');

      expect(tx.accountCategory.findUniqueOrThrow).toHaveBeenCalledWith({ where: { code: 'LIABILITY' } });
      expect(tx.ledgerAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: '1019318292', categoryId: 'liability-cat', customerAccountId: 'account-1' }) }),
      );
      expect(tx.accountBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accountId: 'account-1', ledgerAccountId: 'ledger-acc-1', availableBalance: 0, currentBalance: 0 }) }),
      );
      expect(result).toEqual({ ledgerAccountId: 'ledger-acc-1' });
    });
  });

  describe('postOpeningBalance', () => {
    it('posts a balanced two-line journal entry (debit Cash, credit the customer ledger account) and updates the balance', async () => {
      tx.financialPeriod.findUnique.mockResolvedValue({ id: 'period-1', status: 'OPEN' });
      tx.journalEntry.create.mockResolvedValue({
        id: 'je-1',
        lines: [
          { id: 'line-debit', ledgerAccountId: 'cash-ledger-acc', direction: 'DEBIT', amount: 250 },
          { id: 'line-credit', ledgerAccountId: 'customer-ledger-acc', direction: 'CREDIT', amount: 250 },
        ],
      });

      const result = await service.postOpeningBalance(tx as unknown as Prisma.TransactionClient, {
        customerLedgerAccountId: 'customer-ledger-acc',
        amount: 250,
        currencyId: 'usd-id',
        accountId: 'account-1',
        description: 'Opening balance — Fixed Deposit',
      });

      const createCall = tx.journalEntry.create.mock.calls[0][0];
      expect(createCall.data.lines.create).toHaveLength(2);
      expect(createCall.data.lines.create[0]).toEqual(expect.objectContaining({ direction: 'DEBIT', amount: 250, ledgerAccountId: 'cash-ledger-acc' }));
      expect(createCall.data.lines.create[1]).toEqual(expect.objectContaining({ direction: 'CREDIT', amount: 250, ledgerAccountId: 'customer-ledger-acc' }));

      expect(tx.accountBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'account-1' },
          data: expect.objectContaining({ availableBalance: 250, currentBalance: 250, lastJournalLineId: 'line-credit' }),
        }),
      );
      expect(result.journalEntryId).toBe('je-1');
      expect(result.journalNumber).toMatch(/^JE\d{9}$/);
    });

    it('auto-provisions the current calendar-month financial period when none exists yet', async () => {
      tx.financialPeriod.findUnique.mockResolvedValue(null);
      tx.financialPeriod.create.mockResolvedValue({ id: 'new-period', status: 'OPEN' });
      tx.journalEntry.create.mockResolvedValue({ id: 'je-1', lines: [{ id: 'line-credit', ledgerAccountId: 'customer-ledger-acc', direction: 'CREDIT', amount: 100 }] });

      await service.postOpeningBalance(tx as unknown as Prisma.TransactionClient, {
        customerLedgerAccountId: 'customer-ledger-acc',
        amount: 100,
        currencyId: 'usd-id',
        accountId: 'account-1',
        description: 'test',
      });

      expect(tx.financialPeriod.create).toHaveBeenCalledTimes(1);
      const createArgs = tx.financialPeriod.create.mock.calls[0][0].data;
      expect(createArgs.status).toBe('OPEN');
      expect(createArgs.endDate.getTime()).toBeGreaterThan(createArgs.startDate.getTime());
    });

    it('refuses to post into a LOCKED financial period', async () => {
      tx.financialPeriod.findUnique.mockResolvedValue({ id: 'period-1', status: 'LOCKED' });

      await expect(
        service.postOpeningBalance(tx as unknown as Prisma.TransactionClient, {
          customerLedgerAccountId: 'customer-ledger-acc',
          amount: 100,
          currencyId: 'usd-id',
          accountId: 'account-1',
          description: 'test',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});

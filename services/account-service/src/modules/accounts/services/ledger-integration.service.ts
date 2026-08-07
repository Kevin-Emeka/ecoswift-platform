import { randomInt } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@ecoswift/database';

const CASH_LEDGER_ACCOUNT_CODE = '1000'; // "Cash and Bank Balances" — prisma/seed.ts § seedChartOfAccounts

/**
 * Wires a newly-opened `Account` into the double-entry ledger
 * (docs/ledger-design.md, docs/account-opening.md § Ledger Integration).
 * Every method here is written to run inside the caller's transaction
 * (`Prisma.TransactionClient`, not the module-level `PrismaService`) so
 * account creation, ledger-account creation, and the opening journal
 * entry (when there is one) commit or roll back together — a customer
 * `Account` must never exist without its `LedgerAccount`/`AccountBalance`
 * counterpart.
 */
@Injectable()
export class LedgerIntegrationService {
  /**
   * Creates the per-customer `LedgerAccount` (category LIABILITY — the
   * bank owes the customer their balance) and a zeroed `AccountBalance`
   * row. Every opened `Account` gets this, regardless of opening balance —
   * "Create ledger accounts" (Phase 4A brief) is unconditional; posting a
   * journal entry is not (see `postOpeningBalance` below).
   */
  async createCustomerLedgerAccount(
    tx: Prisma.TransactionClient,
    accountId: string,
    accountNumber: string,
    accountName: string,
  ): Promise<{ ledgerAccountId: string }> {
    const liabilityCategory = await tx.accountCategory.findUniqueOrThrow({ where: { code: 'LIABILITY' } });

    const ledgerAccount = await tx.ledgerAccount.create({
      data: {
        code: accountNumber,
        name: accountName,
        categoryId: liabilityCategory.id,
        customerAccountId: accountId,
      },
    });

    await tx.accountBalance.create({
      data: {
        accountId,
        ledgerAccountId: ledgerAccount.id,
        availableBalance: 0,
        currentBalance: 0,
      },
    });

    return { ledgerAccountId: ledgerAccount.id };
  }

  /**
   * Posts the opening journal entry — **only called when `amount > 0`**.
   * `journal_lines_amount_positive` (a hand-authored Phase 2B check
   * constraint, `CHECK ("amount" > 0)`) makes a zero-value entry
   * impossible, and correctly so: no money moved, nothing to record. A
   * `$0` account opening (the default for CURRENT/SAVINGS) creates *no*
   * `JournalEntry` at all — see docs/account-opening.md § Opening Journal
   * Entry for the full reasoning, including why this is not the
   * "Deposits" feature the stop condition excludes.
   *
   * Debits the bank's own "Cash and Bank Balances" ledger account and
   * credits the new customer ledger account — the standard double-entry
   * treatment for funds entering the bank at account-opening time.
   */
  async postOpeningBalance(
    tx: Prisma.TransactionClient,
    params: {
      customerLedgerAccountId: string;
      amount: number;
      currencyId: string;
      accountId: string;
      description: string;
    },
  ): Promise<{ journalEntryId: string; journalNumber: string }> {
    const cashLedgerAccount = await tx.ledgerAccount.findUniqueOrThrow({ where: { code: CASH_LEDGER_ACCOUNT_CODE } });
    const financialPeriod = await this.ensureCurrentFinancialPeriod(tx);
    const journalNumber = await this.generateJournalNumber(tx);

    const journalEntry = await tx.journalEntry.create({
      data: {
        journalNumber,
        description: params.description,
        financialPeriodId: financialPeriod.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              lineNumber: 1,
              ledgerAccountId: cashLedgerAccount.id,
              direction: 'DEBIT',
              amount: params.amount,
              currencyId: params.currencyId,
              description: 'Funds received — account opening',
            },
            {
              lineNumber: 2,
              ledgerAccountId: params.customerLedgerAccountId,
              direction: 'CREDIT',
              amount: params.amount,
              currencyId: params.currencyId,
              description: 'Opening balance credited',
            },
          ],
        },
      },
      include: { lines: true },
    });

    const creditLine = journalEntry.lines.find((line) => line.ledgerAccountId === params.customerLedgerAccountId);
    if (!creditLine) {
      throw new InternalServerErrorException('Opening journal entry did not produce the expected credit line');
    }

    await tx.accountBalance.update({
      where: { accountId: params.accountId },
      data: {
        availableBalance: params.amount,
        currentBalance: params.amount,
        lastJournalLineId: creditLine.id,
        lastReconciledAt: new Date(),
      },
    });

    return { journalEntryId: journalEntry.id, journalNumber };
  }

  /**
   * Finds the `OPEN` `FinancialPeriod` covering today, auto-provisioning
   * a calendar-month period if none exists yet — Phase 2B's schema
   * defines `FinancialPeriod` but nothing before this phase ever posted a
   * `JournalEntry`, so no period has ever needed to exist until now.
   */
  private async ensureCurrentFinancialPeriod(tx: Prisma.TransactionClient) {
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const name = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const existing = await tx.financialPeriod.findUnique({ where: { name } });
    if (existing) {
      if (existing.status === 'LOCKED') {
        throw new InternalServerErrorException(`Financial period ${name} is locked — cannot post a journal entry`);
      }
      return existing;
    }

    return tx.financialPeriod.create({ data: { name, startDate, endDate, status: 'OPEN' } });
  }

  private async generateJournalNumber(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `JE${randomInt(100_000_000, 999_999_999)}`;
      const existing = await tx.journalEntry.findUnique({ where: { journalNumber: candidate } });
      if (!existing) return candidate;
    }
    throw new InternalServerErrorException('Could not generate a unique journal number');
  }
}

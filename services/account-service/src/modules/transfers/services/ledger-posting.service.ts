import { randomInt } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@ecoswift/database';

/**
 * The only code in `transfers` allowed to touch `JournalEntry`/`JournalLine`
 * or write to `AccountBalance` — the "Ledger Service" boundary the
 * milestone 2 brief asks for, implemented as a module-level guarantee
 * rather than a separate deployable service (see `TransfersModule` doc
 * comment for why). `InternalTransferService` performs all business
 * validation and calls this only once it has decided a transfer may post;
 * this service does not re-validate business rules, only accounting
 * invariants (the transaction is always run inside the caller's
 * `Prisma.TransactionClient` so the journal entry and both balance updates
 * commit or roll back together).
 */
@Injectable()
export class LedgerPostingService {
  /**
   * Posts a balanced journal entry moving `amount` from the source
   * customer's ledger account to the destination customer's ledger
   * account, and updates both `AccountBalance` rows. Unlike a
   * deposit/withdrawal, no bank-owned "Cash" ledger account is touched —
   * the funds never leave the bank's books, they move between two ledger
   * accounts the bank already carries as liabilities to its customers.
   */
  async postInternalTransfer(
    tx: Prisma.TransactionClient,
    params: {
      transactionId: string;
      sourceAccountId: string;
      sourceLedgerAccountId: string;
      destinationAccountId: string;
      destinationLedgerAccountId: string;
      amount: number;
      currencyId: string;
      description: string;
    },
  ): Promise<{ journalEntryId: string; journalNumber: string }> {
    const financialPeriod = await this.ensureCurrentFinancialPeriod(tx);
    const journalNumber = await this.generateJournalNumber(tx);

    const journalEntry = await tx.journalEntry.create({
      data: {
        journalNumber,
        transactionId: params.transactionId,
        description: params.description,
        financialPeriodId: financialPeriod.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              lineNumber: 1,
              ledgerAccountId: params.sourceLedgerAccountId,
              direction: 'DEBIT',
              amount: params.amount,
              currencyId: params.currencyId,
              description: params.description,
            },
            {
              lineNumber: 2,
              ledgerAccountId: params.destinationLedgerAccountId,
              direction: 'CREDIT',
              amount: params.amount,
              currencyId: params.currencyId,
              description: params.description,
            },
          ],
        },
      },
      include: { lines: true },
    });

    const debitLine = journalEntry.lines.find((line) => line.ledgerAccountId === params.sourceLedgerAccountId);
    const creditLine = journalEntry.lines.find((line) => line.ledgerAccountId === params.destinationLedgerAccountId);
    if (!debitLine || !creditLine) {
      throw new InternalServerErrorException('Transfer journal entry did not produce the expected debit/credit lines');
    }

    await tx.accountBalance.update({
      where: { accountId: params.sourceAccountId },
      data: {
        availableBalance: { decrement: params.amount },
        currentBalance: { decrement: params.amount },
        lastJournalLineId: debitLine.id,
        lastReconciledAt: new Date(),
      },
    });

    await tx.accountBalance.update({
      where: { accountId: params.destinationAccountId },
      data: {
        availableBalance: { increment: params.amount },
        currentBalance: { increment: params.amount },
        lastJournalLineId: creditLine.id,
        lastReconciledAt: new Date(),
      },
    });

    return { journalEntryId: journalEntry.id, journalNumber };
  }

  /**
   * Posts an external transfer's ledger effect — debit the customer's
   * ledger account, credit the bank's own Cash ledger account — since,
   * from the bank's own books, money "leaving" to an external party is
   * mechanically identical to a withdrawal. See `ExternalTransferService`'s
   * doc comment for why this settlement is simulated rather than real.
   */
  async postExternalTransfer(
    tx: Prisma.TransactionClient,
    params: {
      transactionId: string;
      sourceAccountId: string;
      sourceLedgerAccountId: string;
      cashLedgerAccountId: string;
      amount: number;
      currencyId: string;
      description: string;
    },
  ): Promise<{ journalEntryId: string; journalNumber: string }> {
    const financialPeriod = await this.ensureCurrentFinancialPeriod(tx);
    const journalNumber = await this.generateJournalNumber(tx);

    const journalEntry = await tx.journalEntry.create({
      data: {
        journalNumber,
        transactionId: params.transactionId,
        description: params.description,
        financialPeriodId: financialPeriod.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              lineNumber: 1,
              ledgerAccountId: params.sourceLedgerAccountId,
              direction: 'DEBIT',
              amount: params.amount,
              currencyId: params.currencyId,
              description: params.description,
            },
            {
              lineNumber: 2,
              ledgerAccountId: params.cashLedgerAccountId,
              direction: 'CREDIT',
              amount: params.amount,
              currencyId: params.currencyId,
              description: params.description,
            },
          ],
        },
      },
      include: { lines: true },
    });

    const debitLine = journalEntry.lines.find((line) => line.ledgerAccountId === params.sourceLedgerAccountId);
    if (!debitLine) {
      throw new InternalServerErrorException('Transfer journal entry did not produce the expected debit line');
    }

    await tx.accountBalance.update({
      where: { accountId: params.sourceAccountId },
      data: {
        availableBalance: { decrement: params.amount },
        currentBalance: { decrement: params.amount },
        lastJournalLineId: debitLine.id,
        lastReconciledAt: new Date(),
      },
    });

    return { journalEntryId: journalEntry.id, journalNumber };
  }

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

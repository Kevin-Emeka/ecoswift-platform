import { randomInt } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@ecoswift/database';
import { EVENT_PUBLISHER, DEPOSIT_POSTED, WITHDRAWAL_POSTED } from '@ecoswift/event-bus';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { RECEIPTS_QUEUE } from '@ecoswift/queue';
import type { QueuePort, ReceiptJobPayload } from '@ecoswift/queue';
import { AuditService } from '../../../common/services/audit.service';
import type { TransactionResponseDto } from '../dto/transaction-response.dto';

const CASH_LEDGER_ACCOUNT_CODE = '1000';

/**
 * Simulated deposits/withdrawals — Milestone 1's "BANKING" brief: "Support
 * simulated deposits and withdrawals strictly within the sandbox
 * environment for testing the platform end-to-end." Every transaction
 * created here is clearly, structurally sandbox-only:
 *
 * - `description` is always prefixed `[SANDBOX]`.
 * - The API response always carries `sandbox: true` (`TransactionResponseDto`).
 * - `assertSandboxEnabled()` refuses to run at all when `NODE_ENV === 'production'`
 *   — defense in depth beyond "this whole deployment is dev-only," since a
 *   real deployment must never let a client trigger a fabricated ledger
 *   posting.
 *
 * Otherwise this reuses the exact same double-entry mechanics
 * `LedgerIntegrationService` established for account opening (Phase 4A) —
 * a deposit debits the bank's `1000` Cash ledger account and credits the
 * customer's own `LedgerAccount`; a withdrawal is the mirror image. This
 * is deliberately built directly against `Account`/`LedgerAccount` rather
 * than standing up a separate `transaction-service` microservice —
 * account-service already owns the Account and Ledger domain end to end
 * (Phase 4A), and a deposit/withdrawal is ledger activity on an account
 * this service already fully models; splitting it into a new service would
 * mean re-deriving JWT/authz/DB wiring for no architectural benefit.
 */
@Injectable()
export class SandboxTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
    @Inject(RECEIPTS_QUEUE) private readonly receiptsQueue: QueuePort<ReceiptJobPayload>,
  ) {}

  async deposit(userId: string, accountId: string, amount: number, description: string | undefined): Promise<TransactionResponseDto> {
    this.assertSandboxEnabled();
    const account = await this.loadOwnedActiveAccount(userId, accountId);
    const depositType = await this.prisma.transactionType.findUniqueOrThrow({ where: { code: 'DEPOSIT' } });
    const cashLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { code: CASH_LEDGER_ACCOUNT_CODE } });
    const customerLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: accountId } });
    const financialPeriod = await this.ensureCurrentFinancialPeriod();
    const reference = await this.generateTransactionReference();
    const label = `[SANDBOX] ${description ?? 'Simulated deposit'}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          transactionReference: reference,
          transactionTypeId: depositType.id,
          destinationAccountId: accountId,
          amount,
          currencyId: account.currencyId,
          status: 'COMPLETED',
          initiatedBy: userId,
          description: label,
          completedAt: new Date(),
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          journalNumber: await this.generateJournalNumber(tx),
          transactionId: transaction.id,
          description: label,
          financialPeriodId: financialPeriod.id,
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { lineNumber: 1, ledgerAccountId: cashLedgerAccount.id, direction: 'DEBIT', amount, currencyId: account.currencyId, description: label },
              { lineNumber: 2, ledgerAccountId: customerLedgerAccount.id, direction: 'CREDIT', amount, currencyId: account.currencyId, description: label },
            ],
          },
        },
        include: { lines: true },
      });

      const creditLine = journalEntry.lines.find((line) => line.ledgerAccountId === customerLedgerAccount.id)!;
      const balance = await tx.accountBalance.update({
        where: { accountId },
        data: {
          availableBalance: { increment: amount },
          currentBalance: { increment: amount },
          lastJournalLineId: creditLine.id,
          lastReconciledAt: new Date(),
        },
      });

      return { transaction, journalEntry, balance };
    });

    await this.eventPublisher.publish({
      eventType: DEPOSIT_POSTED,
      producerContext: 'account-service',
      payload: {
        accountId,
        transactionId: result.transaction.id,
        journalEntryId: result.journalEntry.id,
        amount: String(amount),
        currencyCode: account.currency.isoCode,
        source: 'sandbox',
      },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'CREATE',
      resourceType: 'Transaction',
      resourceId: result.transaction.id,
      description: label,
      afterState: { amount, direction: 'DEPOSIT', accountId },
    });

    await this.receiptsQueue.enqueue({ transactionId: result.transaction.id, format: 'JSON' });

    return this.toResponseDto(result.transaction, account.currency.isoCode);
  }

  /**
   * Staff-assisted funding of a customer's *existing* account — the
   * counterpart to self-service deposit, for cases like backfilling an
   * opening balance a customer couldn't self-declare (see
   * `OpenAccountDto`'s doc comment: self-service accounts always open at
   * $0). Deliberately not exposed to customers: gated by `accounts:credit`
   * (staff-only role grant — see `PERMISSION_CATALOG`) at the controller,
   * and by `assertSandboxEnabled()` here, same as deposit/withdraw — this
   * is still fabricated money, so it carries the same `[SANDBOX]`
   * labeling and the same production kill-switch. `reason` is mandatory
   * (unlike self-service's optional description) since this is staff
   * moving money into someone else's account and needs to be justifiable
   * on the audit trail.
   */
  async adminCredit(staffUserId: string, accountId: string, amount: number, reason: string): Promise<TransactionResponseDto> {
    this.assertSandboxEnabled();
    const account = await this.loadActiveAccount(accountId);
    const creditType = await this.prisma.transactionType.findUniqueOrThrow({ where: { code: 'ADMIN_CREDIT' } });
    const cashLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { code: CASH_LEDGER_ACCOUNT_CODE } });
    const customerLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: accountId } });
    const financialPeriod = await this.ensureCurrentFinancialPeriod();
    const reference = await this.generateTransactionReference();
    const label = `[SANDBOX] Admin credit — ${reason}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          transactionReference: reference,
          transactionTypeId: creditType.id,
          destinationAccountId: accountId,
          amount,
          currencyId: account.currencyId,
          status: 'COMPLETED',
          initiatedBy: staffUserId,
          description: label,
          completedAt: new Date(),
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          journalNumber: await this.generateJournalNumber(tx),
          transactionId: transaction.id,
          description: label,
          financialPeriodId: financialPeriod.id,
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { lineNumber: 1, ledgerAccountId: cashLedgerAccount.id, direction: 'DEBIT', amount, currencyId: account.currencyId, description: label },
              { lineNumber: 2, ledgerAccountId: customerLedgerAccount.id, direction: 'CREDIT', amount, currencyId: account.currencyId, description: label },
            ],
          },
        },
        include: { lines: true },
      });

      const creditLine = journalEntry.lines.find((line) => line.ledgerAccountId === customerLedgerAccount.id)!;
      await tx.accountBalance.update({
        where: { accountId },
        data: {
          availableBalance: { increment: amount },
          currentBalance: { increment: amount },
          lastJournalLineId: creditLine.id,
          lastReconciledAt: new Date(),
        },
      });

      return { transaction, journalEntry };
    });

    await this.eventPublisher.publish({
      eventType: DEPOSIT_POSTED,
      producerContext: 'account-service',
      payload: {
        accountId,
        transactionId: result.transaction.id,
        journalEntryId: result.journalEntry.id,
        amount: String(amount),
        currencyCode: account.currency.isoCode,
        source: 'admin-credit',
      },
    });

    await this.auditService.record({
      actorUserId: staffUserId,
      actorType: 'STAFF',
      actionType: 'CREATE',
      resourceType: 'Transaction',
      resourceId: result.transaction.id,
      description: label,
      afterState: { amount, direction: 'ADMIN_CREDIT', accountId, reason },
    });

    await this.receiptsQueue.enqueue({ transactionId: result.transaction.id, format: 'JSON' });

    return this.toResponseDto(result.transaction, account.currency.isoCode);
  }

  async withdraw(userId: string, accountId: string, amount: number, description: string | undefined): Promise<TransactionResponseDto> {
    this.assertSandboxEnabled();
    const account = await this.loadOwnedActiveAccount(userId, accountId);

    const balance = await this.prisma.accountBalance.findUniqueOrThrow({ where: { accountId } });
    if (!account.accountType.allowsOverdraft && Number(balance.availableBalance) < amount) {
      throw new BadRequestException('Insufficient available balance for this withdrawal');
    }

    const withdrawalType = await this.prisma.transactionType.findUniqueOrThrow({ where: { code: 'WITHDRAWAL' } });
    const cashLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { code: CASH_LEDGER_ACCOUNT_CODE } });
    const customerLedgerAccount = await this.prisma.ledgerAccount.findUniqueOrThrow({ where: { customerAccountId: accountId } });
    const financialPeriod = await this.ensureCurrentFinancialPeriod();
    const reference = await this.generateTransactionReference();
    const label = `[SANDBOX] ${description ?? 'Simulated withdrawal'}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          transactionReference: reference,
          transactionTypeId: withdrawalType.id,
          sourceAccountId: accountId,
          amount,
          currencyId: account.currencyId,
          status: 'COMPLETED',
          initiatedBy: userId,
          description: label,
          completedAt: new Date(),
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          journalNumber: await this.generateJournalNumber(tx),
          transactionId: transaction.id,
          description: label,
          financialPeriodId: financialPeriod.id,
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { lineNumber: 1, ledgerAccountId: customerLedgerAccount.id, direction: 'DEBIT', amount, currencyId: account.currencyId, description: label },
              { lineNumber: 2, ledgerAccountId: cashLedgerAccount.id, direction: 'CREDIT', amount, currencyId: account.currencyId, description: label },
            ],
          },
        },
        include: { lines: true },
      });

      const debitLine = journalEntry.lines.find((line) => line.ledgerAccountId === customerLedgerAccount.id)!;
      await tx.accountBalance.update({
        where: { accountId },
        data: {
          availableBalance: { decrement: amount },
          currentBalance: { decrement: amount },
          lastJournalLineId: debitLine.id,
          lastReconciledAt: new Date(),
        },
      });

      return { transaction, journalEntry };
    });

    await this.eventPublisher.publish({
      eventType: WITHDRAWAL_POSTED,
      producerContext: 'account-service',
      payload: {
        accountId,
        transactionId: result.transaction.id,
        journalEntryId: result.journalEntry.id,
        amount: String(amount),
        currencyCode: account.currency.isoCode,
        destination: 'sandbox',
      },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'CREATE',
      resourceType: 'Transaction',
      resourceId: result.transaction.id,
      description: label,
      afterState: { amount, direction: 'WITHDRAWAL', accountId },
    });

    await this.receiptsQueue.enqueue({ transactionId: result.transaction.id, format: 'JSON' });

    return this.toResponseDto(result.transaction, account.currency.isoCode);
  }

  private assertSandboxEnabled(): void {
    if (this.configService.get<string>('nodeEnv') === 'production') {
      throw new ForbiddenException('Simulated deposits/withdrawals are a sandbox-only feature and are disabled in this environment');
    }
  }

  private async loadOwnedActiveAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { customer: true, currency: true, accountType: true },
    });
    if (!account || account.customer.userId !== userId) {
      throw new NotFoundException('Account not found');
    }
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException(`Account must be ACTIVE to transact (current status: ${account.status})`);
    }
    return account;
  }

  /** Staff variant of `loadOwnedActiveAccount` — no ownership restriction (staff can credit any customer's account), same ACTIVE-status requirement. */
  private async loadActiveAccount(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { customer: true, currency: true, accountType: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException(`Account must be ACTIVE to transact (current status: ${account.status})`);
    }
    return account;
  }

  private async ensureCurrentFinancialPeriod() {
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const name = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const existing = await this.prisma.financialPeriod.findUnique({ where: { name } });
    if (existing) {
      if (existing.status === 'LOCKED') {
        throw new BadRequestException(`Financial period ${name} is locked`);
      }
      return existing;
    }
    return this.prisma.financialPeriod.create({ data: { name, startDate, endDate, status: 'OPEN' } });
  }

  private async generateTransactionReference(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `TXN${randomInt(100_000_000, 999_999_999)}`;
      const existing = await this.prisma.transaction.findUnique({ where: { transactionReference: candidate } });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique transaction reference');
  }

  private async generateJournalNumber(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `JE${randomInt(100_000_000, 999_999_999)}`;
      const existing = await tx.journalEntry.findUnique({ where: { journalNumber: candidate } });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique journal number');
  }

  private toResponseDto(
    transaction: {
      id: string;
      transactionReference: string;
      sourceAccountId: string | null;
      destinationAccountId: string | null;
      amount: unknown;
      status: string;
      description: string | null;
      createdAt: Date;
      completedAt: Date | null;
    },
    currencyCode: string,
  ): TransactionResponseDto {
    return {
      id: transaction.id,
      transactionReference: transaction.transactionReference,
      transactionType: transaction.destinationAccountId && !transaction.sourceAccountId ? 'DEPOSIT' : 'WITHDRAWAL',
      sourceAccountId: transaction.sourceAccountId ?? undefined,
      destinationAccountId: transaction.destinationAccountId ?? undefined,
      amount: String(transaction.amount),
      currencyCode,
      status: transaction.status,
      description: transaction.description ?? undefined,
      sandbox: true,
      createdAt: transaction.createdAt.toISOString(),
      completedAt: transaction.completedAt?.toISOString(),
    };
  }
}

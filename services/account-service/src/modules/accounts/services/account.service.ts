import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ecoswift/database';
import { EVENT_PUBLISHER, ACCOUNT_OPENED } from '@ecoswift/event-bus';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { AccountNumberService } from './account-number.service';
import { LedgerIntegrationService } from './ledger-integration.service';
import { AccountNotificationService } from '../../../common/services/account-notification.service';
import { AuditService } from '../../../common/services/audit.service';
import type { OpenAccountDto } from '../dto/open-account.dto';
import type { AccountResponseDto } from '../dto/account-response.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountNumberService: AccountNumberService,
    private readonly ledgerIntegrationService: LedgerIntegrationService,
    private readonly notificationService: AccountNotificationService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  /**
   * Opens a new account for the caller's own `Customer` record
   * (self-service only this phase — see docs/account-opening.md § What
   * This Phase Did Not Build for staff-assisted opening). Always opens at
   * $0: a self-service customer has no legitimate way to fund an account
   * at creation (that would let them declare their own starting balance),
   * so no journal entry is posted here — only staff-assisted opening,
   * once built, should be able to fund an account at open time. An account
   * type with a `minimumOpeningBalance` above 0 (e.g. Fixed Deposit) is
   * therefore not self-service-openable until a real funding-at-opening
   * flow exists; that's intentional, not a bug. Orchestrates, inside a
   * single transaction: `Account` creation and the per-customer
   * `LedgerAccount`/`AccountBalance` — then, outside the transaction
   * (these are side effects that must not roll back the financial write if
   * they fail): the `AccountOpened` domain event, the audit log, and the
   * three account-opening notifications.
   */
  async open(userId: string, dto: OpenAccountDto): Promise<AccountResponseDto> {
    const customer = await this.prisma.customer.findUnique({ where: { userId }, include: { user: { include: { profile: true } } } });
    if (!customer) {
      throw new NotFoundException('Customer record not found for the authenticated user');
    }

    const accountType = await this.prisma.accountType.findUnique({ where: { code: dto.accountTypeCode } });
    if (!accountType || !accountType.isActive) {
      throw new BadRequestException(`Unknown or inactive account type "${dto.accountTypeCode}"`);
    }

    const currency = await this.prisma.currency.findUnique({ where: { isoCode: dto.currencyCode.toUpperCase() } });
    if (!currency || currency.status !== 'ACTIVE') {
      throw new BadRequestException(`Unknown or inactive currency "${dto.currencyCode}"`);
    }

    // Always 0 for self-service — see the class doc comment on `open()`.
    const openingBalance = 0;
    const minimumOpeningBalance = Number(accountType.minimumOpeningBalance);
    if (openingBalance < minimumOpeningBalance) {
      throw new BadRequestException(
        `${accountType.name} requires an opening balance of at least ${minimumOpeningBalance} ${currency.isoCode}`,
      );
    }

    const accountNumber = await this.accountNumberService.generate(accountType.code);

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          accountNumber,
          customerId: customer.id,
          accountTypeId: accountType.id,
          currencyId: currency.id,
          status: 'PENDING_ACTIVATION',
          openedAt: new Date(),
        },
      });

      const { ledgerAccountId } = await this.ledgerIntegrationService.createCustomerLedgerAccount(
        tx,
        account.id,
        accountNumber,
        `${accountType.name} — ${accountNumber}`,
      );

      let openingJournalNumber: string | undefined;
      if (openingBalance > 0) {
        const posting = await this.ledgerIntegrationService.postOpeningBalance(tx, {
          customerLedgerAccountId: ledgerAccountId,
          amount: openingBalance,
          currencyId: currency.id,
          accountId: account.id,
          description: `Opening balance — ${accountType.name} ${accountNumber}`,
        });
        openingJournalNumber = posting.journalNumber;
      }

      return { account, openingJournalNumber };
    });

    await this.eventPublisher.publish({
      eventType: ACCOUNT_OPENED,
      producerContext: 'account-service',
      payload: {
        accountId: result.account.id,
        accountNumber,
        customerId: customer.id,
        accountTypeCode: accountType.code,
        currencyCode: currency.isoCode,
      },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'CREATE',
      resourceType: 'Account',
      resourceId: result.account.id,
      description: `Opened ${accountType.name} ${accountNumber} (${currency.isoCode})`,
      afterState: {
        accountNumber,
        accountTypeCode: accountType.code,
        currencyCode: currency.isoCode,
        openingBalance,
        status: 'PENDING_ACTIVATION',
      },
    });

    await this.sendAccountOpenedNotifications(customer, accountType.name, accountNumber, currency.isoCode);

    return this.toResponseDto(result.account.id);
  }

  async getById(accountId: string): Promise<AccountResponseDto> {
    return this.toResponseDto(accountId);
  }

  async listForCustomer(customerId: string): Promise<AccountResponseDto[]> {
    const accounts = await this.prisma.account.findMany({ where: { customerId }, orderBy: { openedAt: 'desc' } });
    return Promise.all(accounts.map((account) => this.toResponseDto(account.id)));
  }

  private async sendAccountOpenedNotifications(
    customer: { user: { email: string; phone: string | null; profile: { firstName: string } | null } },
    accountTypeName: string,
    accountNumber: string,
    currencyCode: string,
  ): Promise<void> {
    const firstName = customer.user.profile?.firstName ?? 'there';
    const variables = {
      firstName,
      accountTypeName,
      accountNumber,
      currencyCode,
      portalUrl: this.configService.get<string>('customerPortalUrl') ?? 'http://localhost:3200',
      year: String(new Date().getFullYear()),
    };

    await this.notificationService.sendEmail({
      toAddress: customer.user.email,
      templateCode: 'ACCOUNT_OPENED',
      variables,
    });

    if (customer.user.phone) {
      await this.notificationService.sendSms({
        toNumber: customer.user.phone,
        templateCode: 'ACCOUNT_OPENED_SMS',
        variables,
      });
    }

    await this.notificationService.sendPush({
      templateCode: 'ACCOUNT_OPENED_PUSH',
      variables,
    });
  }

  private async toResponseDto(accountId: string): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { accountType: true, currency: true, balance: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    let openingJournalNumber: string | undefined;
    if (account.balance?.lastJournalLineId) {
      const line = await this.prisma.journalLine.findUnique({
        where: { id: account.balance.lastJournalLineId },
        include: { journalEntry: true },
      });
      openingJournalNumber = line?.journalEntry.journalNumber;
    }

    return {
      id: account.id,
      accountNumber: account.accountNumber,
      customerId: account.customerId,
      accountTypeCode: account.accountType.code,
      currencyCode: account.currency.isoCode,
      status: account.status,
      availableBalance: (account.balance?.availableBalance ?? 0).toString(),
      currentBalance: (account.balance?.currentBalance ?? 0).toString(),
      openedAt: account.openedAt.toISOString(),
      closedAt: account.closedAt?.toISOString(),
      openingJournalNumber,
    };
  }
}

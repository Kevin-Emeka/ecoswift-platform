import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountService } from './account.service';
import type { AccountNumberService } from './account-number.service';
import type { LedgerIntegrationService } from './ledger-integration.service';
import type { AccountNotificationService } from '../../../common/services/account-notification.service';
import type { AuditService } from '../../../common/services/audit.service';
import type { PrismaService } from '@ecoswift/database';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { ConfigService } from '@nestjs/config';

describe('AccountService', () => {
  let prisma: {
    customer: { findUnique: jest.Mock };
    accountType: { findUnique: jest.Mock };
    currency: { findUnique: jest.Mock };
    account: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
    journalLine: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let accountNumberService: jest.Mocked<Pick<AccountNumberService, 'generate'>>;
  let ledgerIntegrationService: jest.Mocked<Pick<LedgerIntegrationService, 'createCustomerLedgerAccount' | 'postOpeningBalance'>>;
  let notificationService: jest.Mocked<Pick<AccountNotificationService, 'sendEmail' | 'sendSms' | 'sendPush'>>;
  let auditService: jest.Mocked<Pick<AuditService, 'record'>>;
  let eventPublisher: { publish: jest.Mock };
  let configService: { get: jest.Mock };
  let service: AccountService;

  const customer = {
    id: 'customer-1',
    user: { email: 'grace@example.com', phone: '+15551234567', profile: { firstName: 'Grace' } },
  };
  const accountType = { id: 'type-savings', code: 'SAVINGS', name: 'Savings Account', isActive: true, minimumOpeningBalance: 0 };
  const currency = { id: 'usd-id', isoCode: 'USD', status: 'ACTIVE' };
  const createdAccount = { id: 'account-1' };

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue(customer) },
      accountType: { findUnique: jest.fn().mockResolvedValue(accountType) },
      currency: { findUnique: jest.fn().mockResolvedValue(currency) },
      account: {
        create: jest.fn().mockResolvedValue(createdAccount),
        findUnique: jest.fn().mockResolvedValue({
          id: 'account-1',
          accountNumber: '1019318292',
          customerId: 'customer-1',
          accountType: { code: 'SAVINGS' },
          currency: { isoCode: 'USD' },
          status: 'PENDING_ACTIVATION',
          balance: { availableBalance: 0, currentBalance: 0, lastJournalLineId: null },
          openedAt: new Date('2026-01-01'),
          closedAt: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalLine: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    accountNumberService = { generate: jest.fn().mockResolvedValue('1019318292') };
    ledgerIntegrationService = {
      createCustomerLedgerAccount: jest.fn().mockResolvedValue({ ledgerAccountId: 'ledger-1' }),
      postOpeningBalance: jest.fn().mockResolvedValue({ journalEntryId: 'je-1', journalNumber: 'JE123456789' }),
    };
    notificationService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendSms: jest.fn().mockResolvedValue(undefined),
      sendPush: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    service = new AccountService(
      prisma as unknown as PrismaService,
      accountNumberService as unknown as AccountNumberService,
      ledgerIntegrationService as unknown as LedgerIntegrationService,
      notificationService as unknown as AccountNotificationService,
      auditService as unknown as AuditService,
      configService as unknown as ConfigService,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  it('404s when the caller has no Customer record', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.open('user-1', { accountTypeCode: 'SAVINGS', currencyCode: 'USD' })).rejects.toThrow(NotFoundException);
  });

  it('rejects an unknown or inactive account type', async () => {
    prisma.accountType.findUnique.mockResolvedValue(null);
    await expect(service.open('user-1', { accountTypeCode: 'NOPE', currencyCode: 'USD' })).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown or inactive currency', async () => {
    prisma.currency.findUnique.mockResolvedValue(null);
    await expect(service.open('user-1', { accountTypeCode: 'SAVINGS', currencyCode: 'XYZ' })).rejects.toThrow(BadRequestException);
  });

  it('rejects self-service opening of an account type with a nonzero minimum opening balance', async () => {
    // Self-service always opens at $0 (see AccountService.open()'s doc
    // comment), so any account type requiring more than $0 to open — e.g.
    // Fixed Deposit — simply can't be opened this way, by design.
    prisma.accountType.findUnique.mockResolvedValue({ ...accountType, code: 'FIXED_DEPOSIT', minimumOpeningBalance: 100 });
    await expect(service.open('user-1', { accountTypeCode: 'FIXED_DEPOSIT', currencyCode: 'USD' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it('opens a $0 account without posting a journal entry, but always creates the ledger account', async () => {
    await service.open('user-1', { accountTypeCode: 'SAVINGS', currencyCode: 'USD' });

    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_ACTIVATION', customerId: 'customer-1' }) }),
    );
    expect(ledgerIntegrationService.createCustomerLedgerAccount).toHaveBeenCalled();
    expect(ledgerIntegrationService.postOpeningBalance).not.toHaveBeenCalled();
  });

  it('ignores an openingBalance smuggled onto the DTO — self-service can never fund at opening', async () => {
    // OpenAccountDto no longer declares this field (and the global
    // ValidationPipe's forbidNonWhitelisted:true rejects it over HTTP
    // before it ever reaches this service) — this test just proves the
    // service itself doesn't trust the field even if a caller bypasses the
    // DTO and calls it directly with an extra property.
    await service.open('user-1', { accountTypeCode: 'SAVINGS', currencyCode: 'USD', openingBalance: 500 } as never);
    expect(ledgerIntegrationService.postOpeningBalance).not.toHaveBeenCalled();
  });

  it('publishes ACCOUNT_OPENED and writes an audit log entry', async () => {
    await service.open('user-1', { accountTypeCode: 'SAVINGS', currencyCode: 'USD' });

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'account.opened', payload: expect.objectContaining({ accountId: 'account-1', accountNumber: '1019318292' }) }),
    );
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'CREATE', resourceType: 'Account', resourceId: 'account-1' }));
  });

  it('sends email and SMS when the customer has a phone number, plus a push notification', async () => {
    await service.open('user-1', { accountTypeCode: 'SAVINGS', currencyCode: 'USD' });

    expect(notificationService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'ACCOUNT_OPENED' }));
    expect(notificationService.sendSms).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'ACCOUNT_OPENED_SMS' }));
    expect(notificationService.sendPush).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'ACCOUNT_OPENED_PUSH' }));
  });

  it('skips SMS when the customer has no phone number on file', async () => {
    prisma.customer.findUnique.mockResolvedValue({ ...customer, user: { ...customer.user, phone: null } });
    await service.open('user-1', { accountTypeCode: 'SAVINGS', currencyCode: 'USD' });
    expect(notificationService.sendSms).not.toHaveBeenCalled();
  });
});

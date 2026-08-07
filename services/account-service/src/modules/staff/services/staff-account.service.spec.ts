import { NotFoundException } from '@nestjs/common';
import { StaffAccountService } from './staff-account.service';
import type { PrismaService } from '@ecoswift/database';

describe('StaffAccountService', () => {
  let prisma: { account: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock } };
  let service: StaffAccountService;

  beforeEach(() => {
    prisma = { account: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() } };
    service = new StaffAccountService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('paginates and maps accounts to summaries', async () => {
      prisma.account.count.mockResolvedValue(7);
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'account-1',
          accountNumber: '1019318292',
          customerId: 'customer-1',
          customer: { customerNumber: 'ESB123' },
          accountType: { code: 'SAVINGS' },
          currency: { isoCode: 'USD' },
          status: 'ACTIVE',
          balance: { availableBalance: 500 },
          openedAt: new Date('2026-01-01'),
        },
      ]);

      const result = await service.list({ page: 1, limit: 20 });
      expect(result.total).toBe(7);
      expect(result.items[0]!.customerNumber).toBe('ESB123');
      expect(result.items[0]!.availableBalance).toBe('500');
    });

    it('filters by account number search and status', async () => {
      await service.list({ page: 1, limit: 20, search: '1019', status: 'ACTIVE' });
      const whereArg = prisma.account.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe('ACTIVE');
      expect(whereArg.accountNumber).toEqual({ contains: '1019', mode: 'insensitive' });
    });
  });

  describe('getById', () => {
    it('404s when the account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the account summary when found', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'account-1',
        accountNumber: '1019318292',
        customerId: 'customer-1',
        customer: { customerNumber: 'ESB123' },
        accountType: { code: 'SAVINGS' },
        currency: { isoCode: 'USD' },
        status: 'ACTIVE',
        balance: { availableBalance: 500 },
        openedAt: new Date('2026-01-01'),
      });

      const result = await service.getById('account-1');
      expect(result.accountNumber).toBe('1019318292');
    });
  });
});

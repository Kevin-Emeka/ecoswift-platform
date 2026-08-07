import { NotFoundException } from '@nestjs/common';
import { StaffCustomerService } from './staff-customer.service';
import type { PrismaService } from '@ecoswift/database';

describe('StaffCustomerService', () => {
  let prisma: { customer: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock } };
  let service: StaffCustomerService;

  beforeEach(() => {
    prisma = { customer: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() } };
    service = new StaffCustomerService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('paginates and maps customers to summaries, including account count', async () => {
      prisma.customer.count.mockResolvedValue(42);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'customer-1',
          customerNumber: 'ESB123',
          status: 'ACTIVE',
          tier: 'TIER_1',
          dateJoined: new Date('2026-01-01'),
          user: { email: 'a@example.com', profile: { firstName: 'Ada', lastName: 'Lovelace' } },
          accounts: [{ id: 'acc-1' }, { id: 'acc-2' }],
        },
      ]);

      const result = await service.list({ page: 2, limit: 10 });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
      expect(result.total).toBe(42);
      expect(result.totalPages).toBe(5);
      expect(result.items[0]!.fullName).toBe('Ada Lovelace');
      expect(result.items[0]!.accountCount).toBe(2);
    });

    it('builds a case-insensitive OR search across customer number, email, first/last name', async () => {
      await service.list({ page: 1, limit: 20, search: 'ada' });
      const whereArg = prisma.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toHaveLength(4);
    });
  });

  describe('getById', () => {
    it('404s when the customer does not exist', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    });

    it('404s when the customer has no profile', async () => {
      prisma.customer.findUnique.mockResolvedValue({ user: { profile: null } });
      await expect(service.getById('customer-1')).rejects.toThrow(NotFoundException);
    });

    it('computes missingFields the same way the self-service profile endpoint does', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'customer-1',
        customerNumber: 'ESB123',
        tier: 'TIER_0',
        status: 'ACTIVE',
        user: {
          profile: {
            firstName: 'Ada',
            middleName: null,
            lastName: 'Lovelace',
            dateOfBirth: new Date('1990-01-01'),
            gender: null,
            addressLine1: null,
            addressLine2: null,
            city: null,
            state: null,
            postalCode: null,
            addressCountryCode: null,
            occupation: null,
            preferredLanguage: 'en',
            preferredCurrencyId: null,
            timezone: 'UTC',
            profileCompletionStatus: 'INCOMPLETE',
            preferredCurrency: null,
          },
        },
      });

      const result = await service.getById('customer-1');
      expect(result.missingFields).toEqual(['addressLine1', 'city', 'addressCountryCode', 'occupation', 'preferredCurrencyId']);
    });
  });
});

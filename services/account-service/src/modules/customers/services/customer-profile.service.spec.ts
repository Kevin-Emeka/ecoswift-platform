import { NotFoundException } from '@nestjs/common';
import { CustomerProfileService } from './customer-profile.service';
import type { PrismaService } from '@ecoswift/database';

describe('CustomerProfileService', () => {
  let prisma: {
    customer: { findUnique: jest.Mock };
    currency: { findUnique: jest.Mock };
    profile: { update: jest.Mock };
  };
  let service: CustomerProfileService;

  const baseProfile = {
    id: 'profile-1',
    firstName: 'Grace',
    middleName: null,
    lastName: 'Hopper',
    dateOfBirth: new Date('1985-12-09'),
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
  };

  const baseCustomer = {
    id: 'customer-1',
    customerNumber: 'ESB123456789',
    tier: 'TIER_0',
    status: 'ACTIVE',
    user: { profile: baseProfile },
  };

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn() },
      currency: { findUnique: jest.fn() },
      profile: { update: jest.fn() },
    };
    service = new CustomerProfileService(prisma as unknown as PrismaService);
  });

  describe('getByUserId', () => {
    it('404s when the customer or its profile does not exist', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.getByUserId('missing-user')).rejects.toThrow(NotFoundException);
    });

    it('reports every required field missing on a freshly registered customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(baseCustomer);
      const result = await service.getByUserId('user-1');

      expect(result.profileCompletionStatus).toBe('INCOMPLETE');
      expect(result.missingFields).toEqual(['addressLine1', 'city', 'addressCountryCode', 'occupation', 'preferredCurrencyId']);
    });
  });

  describe('updateByUserId', () => {
    it('404s when preferredCurrencyId does not match a known currency', async () => {
      prisma.customer.findUnique.mockResolvedValue(baseCustomer);
      prisma.currency.findUnique.mockResolvedValue(null);

      await expect(service.updateByUserId('user-1', { preferredCurrencyId: 'bad-id' })).rejects.toThrow(NotFoundException);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('flips completion status to COMPLETE once every required field is filled', async () => {
      prisma.customer.findUnique.mockResolvedValue(baseCustomer);
      prisma.currency.findUnique.mockResolvedValue({ id: 'usd-id', isoCode: 'USD' });
      prisma.profile.update.mockResolvedValueOnce({
        ...baseProfile,
        addressLine1: '1 Infinite Loop',
        city: 'Cupertino',
        addressCountryCode: 'US',
        occupation: 'Engineer',
        preferredCurrencyId: 'usd-id',
        preferredCurrency: { isoCode: 'USD' },
        profileCompletionStatus: 'INCOMPLETE', // computed and re-persisted by the service, not this fixture
      });
      prisma.profile.update.mockResolvedValueOnce({});

      const result = await service.updateByUserId('user-1', {
        addressLine1: '1 Infinite Loop',
        city: 'Cupertino',
        addressCountryCode: 'US',
        occupation: 'Engineer',
        preferredCurrencyId: 'usd-id',
      });

      expect(result.profileCompletionStatus).toBe('COMPLETE');
      expect(result.missingFields).toEqual([]);
      // Second update call persists the recomputed COMPLETE status.
      expect(prisma.profile.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { profileCompletionStatus: 'COMPLETE' } }),
      );
    });

    it('does not write a redundant profileCompletionStatus update when it has not changed', async () => {
      prisma.customer.findUnique.mockResolvedValue(baseCustomer);
      prisma.profile.update.mockResolvedValueOnce({ ...baseProfile, occupation: 'Engineer', profileCompletionStatus: 'INCOMPLETE' });

      await service.updateByUserId('user-1', { occupation: 'Engineer' });

      expect(prisma.profile.update).toHaveBeenCalledTimes(1);
    });
  });
});

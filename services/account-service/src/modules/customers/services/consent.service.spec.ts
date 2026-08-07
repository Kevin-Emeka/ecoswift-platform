import { NotFoundException } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { ConsentTypeDto } from '../dto/record-consent.dto';
import type { PrismaService } from '@ecoswift/database';

describe('ConsentService', () => {
  let prisma: {
    customer: { findUnique: jest.Mock };
    customerConsent: { create: jest.Mock; findMany: jest.Mock };
  };
  let service: ConsentService;

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn() },
      customerConsent: { create: jest.fn(), findMany: jest.fn() },
    };
    service = new ConsentService(prisma as unknown as PrismaService);
  });

  describe('record', () => {
    it('404s for an unknown customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.record('user-1', { consentType: ConsentTypeDto.TERMS_AND_CONDITIONS, version: '1.0', accepted: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('always inserts a new row — never updates an existing one', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
      prisma.customerConsent.create.mockResolvedValue({
        consentType: 'TERMS_AND_CONDITIONS',
        version: '2026-01-01',
        accepted: true,
        acceptedAt: new Date('2026-01-01T00:00:00Z'),
      });

      await service.record('user-1', { consentType: ConsentTypeDto.TERMS_AND_CONDITIONS, version: '2026-01-01', accepted: true }, '127.0.0.1');

      expect(prisma.customerConsent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: 'customer-1', consentType: 'TERMS_AND_CONDITIONS', version: '2026-01-01', accepted: true, ipAddress: '127.0.0.1' }),
        }),
      );
    });
  });

  describe('currentStatuses', () => {
    it('returns only the most recent row per consent type', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
      prisma.customerConsent.findMany.mockResolvedValue([
        { consentType: 'MARKETING_COMMUNICATIONS', version: '1.0', accepted: false, acceptedAt: new Date('2026-02-01'), createdAt: new Date('2026-02-01') },
        { consentType: 'MARKETING_COMMUNICATIONS', version: '1.0', accepted: true, acceptedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01') },
        { consentType: 'TERMS_AND_CONDITIONS', version: '2026-01-01', accepted: true, acceptedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01') },
      ]);

      const result = await service.currentStatuses('user-1');

      const marketing = result.find((r) => r.consentType === 'MARKETING_COMMUNICATIONS');
      expect(marketing?.accepted).toBe(false); // the more recent (opt-out) row wins
      expect(result).toHaveLength(2);
    });
  });

  describe('hasAcceptedMandatoryConsents', () => {
    it('is true only when both T&C and Privacy Policy are currently accepted', async () => {
      prisma.customerConsent.findMany.mockResolvedValue([
        { consentType: 'TERMS_AND_CONDITIONS', accepted: true, createdAt: new Date('2026-01-01') },
        { consentType: 'PRIVACY_POLICY', accepted: true, createdAt: new Date('2026-01-01') },
      ]);
      expect(await service.hasAcceptedMandatoryConsents('customer-1')).toBe(true);
    });

    it('is false when only one of the two has been accepted', async () => {
      prisma.customerConsent.findMany.mockResolvedValue([{ consentType: 'TERMS_AND_CONDITIONS', accepted: true, createdAt: new Date('2026-01-01') }]);
      expect(await service.hasAcceptedMandatoryConsents('customer-1')).toBe(false);
    });

    it('is false when the most recent Privacy Policy row is a withdrawal', async () => {
      prisma.customerConsent.findMany.mockResolvedValue([
        { consentType: 'PRIVACY_POLICY', accepted: false, createdAt: new Date('2026-02-01') },
        { consentType: 'PRIVACY_POLICY', accepted: true, createdAt: new Date('2026-01-01') },
        { consentType: 'TERMS_AND_CONDITIONS', accepted: true, createdAt: new Date('2026-01-01') },
      ]);
      expect(await service.hasAcceptedMandatoryConsents('customer-1')).toBe(false);
    });
  });
});

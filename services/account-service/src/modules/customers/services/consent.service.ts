import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';
import type { RecordConsentDto } from '../dto/record-consent.dto';

export interface ConsentStatus {
  consentType: string;
  version: string;
  accepted: boolean;
  acceptedAt: string;
}

/**
 * Append-only: every call inserts a new `CustomerConsent` row, never
 * updates one (schema.prisma's doc comment on the model explains why —
 * compliance needs the full history, not just current state). "Current
 * status" for a type is simply the most recent row.
 */
@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async record(userId: string, dto: RecordConsentDto, ipAddress?: string): Promise<ConsentStatus> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const acceptedAt = new Date();
    const created = await this.prisma.customerConsent.create({
      data: {
        customerId: customer.id,
        consentType: dto.consentType as Prisma.CustomerConsentUncheckedCreateInput['consentType'],
        version: dto.version,
        accepted: dto.accepted,
        acceptedAt,
        ipAddress,
      },
    });

    return {
      consentType: created.consentType,
      version: created.version,
      accepted: created.accepted,
      acceptedAt: created.acceptedAt.toISOString(),
    };
  }

  async currentStatuses(userId: string): Promise<ConsentStatus[]> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const rows = await this.prisma.customerConsent.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });

    const latestByType = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByType.has(row.consentType)) {
        latestByType.set(row.consentType, row);
      }
    }

    return [...latestByType.values()].map((row) => ({
      consentType: row.consentType,
      version: row.version,
      accepted: row.accepted,
      acceptedAt: row.acceptedAt.toISOString(),
    }));
  }

  /** Has the customer accepted both mandatory legal documents (any version)? Marketing is opt-in, never mandatory. */
  async hasAcceptedMandatoryConsents(customerId: string): Promise<boolean> {
    const rows = await this.prisma.customerConsent.findMany({
      where: { customerId, consentType: { in: ['TERMS_AND_CONDITIONS', 'PRIVACY_POLICY'] } },
      orderBy: { createdAt: 'desc' },
    });

    const latestByType = new Map<string, boolean>();
    for (const row of rows) {
      if (!latestByType.has(row.consentType)) {
        latestByType.set(row.consentType, row.accepted);
      }
    }

    return latestByType.get('TERMS_AND_CONDITIONS') === true && latestByType.get('PRIVACY_POLICY') === true;
  }
}

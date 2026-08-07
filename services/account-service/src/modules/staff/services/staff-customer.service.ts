import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';
import type { ListCustomersQueryDto } from '../dto/list-query.dto';
import type { CustomerSummaryDto, PaginatedCustomerSummary } from '../dto/staff-summary-response.dto';
import type { CustomerProfileResponseDto } from '../../customers/dto/customer-profile-response.dto';

/**
 * Staff-facing "browse any customer" surface (`customers:list`) — distinct
 * from `CustomerProfileService`, which is self-service only (`GET
 * /v1/customers/me`, always scoped to the caller). Used by the admin
 * panel's Customer Management screen.
 */
@Injectable()
export class StaffCustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCustomersQueryDto): Promise<PaginatedCustomerSummary> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.CustomerWhereInput = {
      status: query.status as Prisma.CustomerWhereInput['status'],
      ...(query.search
        ? {
            OR: [
              { customerNumber: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
              { user: { profile: { firstName: { contains: query.search, mode: 'insensitive' } } } },
              { user: { profile: { lastName: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dateJoined: 'desc' },
        include: { user: { include: { profile: true } }, accounts: { select: { id: true } } },
      }),
    ]);

    const items: CustomerSummaryDto[] = customers.map((customer) => ({
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      fullName: customer.user.profile ? `${customer.user.profile.firstName} ${customer.user.profile.lastName}` : customer.user.email,
      email: customer.user.email,
      status: customer.status,
      tier: customer.tier,
      accountCount: customer.accounts.length,
      dateJoined: customer.dateJoined.toISOString(),
    }));

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getById(customerId: string): Promise<CustomerProfileResponseDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { user: { include: { profile: { include: { preferredCurrency: true } } } } },
    });
    if (!customer || !customer.user.profile) {
      throw new NotFoundException('Customer not found');
    }

    const profile = customer.user.profile;
    const requiredForCompletion = ['addressLine1', 'city', 'addressCountryCode', 'occupation', 'preferredCurrencyId'] as const;
    const missingFields = requiredForCompletion.filter((field) => !(profile as unknown as Record<string, unknown>)[field]);

    return {
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      tier: customer.tier,
      status: customer.status,
      firstName: profile.firstName,
      middleName: profile.middleName ?? undefined,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
      gender: profile.gender ?? undefined,
      addressLine1: profile.addressLine1 ?? undefined,
      addressLine2: profile.addressLine2 ?? undefined,
      city: profile.city ?? undefined,
      state: profile.state ?? undefined,
      postalCode: profile.postalCode ?? undefined,
      addressCountryCode: profile.addressCountryCode ?? undefined,
      occupation: profile.occupation ?? undefined,
      preferredLanguage: profile.preferredLanguage,
      preferredCurrencyCode: profile.preferredCurrency?.isoCode,
      timezone: profile.timezone,
      profileCompletionStatus: profile.profileCompletionStatus,
      missingFields,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { UpdateProfileDto } from '../dto/update-profile.dto';
import type { CustomerProfileResponseDto } from '../dto/customer-profile-response.dto';

/**
 * The fields that must be filled in before a profile counts as
 * `COMPLETE` (Phase 4A brief § Customer Profile "Profile completion
 * status"). Deliberately excludes `preferredLanguage`/`timezone`, which
 * always have a default value and are never genuinely "missing" — a
 * customer who accepts the defaults isn't blocked from completion.
 */
const REQUIRED_FOR_COMPLETION = [
  'addressLine1',
  'city',
  'addressCountryCode',
  'occupation',
  'preferredCurrencyId',
] as const;

@Injectable()
export class CustomerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getByUserId(userId: string): Promise<CustomerProfileResponseDto> {
    const customer = await this.findCustomerWithProfile(userId);
    return this.toResponseDto(customer);
  }

  async updateByUserId(userId: string, dto: UpdateProfileDto): Promise<CustomerProfileResponseDto> {
    const customer = await this.findCustomerWithProfile(userId);

    if (dto.preferredCurrencyId) {
      const currency = await this.prisma.currency.findUnique({ where: { id: dto.preferredCurrencyId } });
      if (!currency) {
        throw new NotFoundException('preferredCurrencyId does not match a known currency');
      }
    }

    const updated = await this.prisma.profile.update({
      where: { id: customer.user.profile!.id },
      data: {
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        addressCountryCode: dto.addressCountryCode,
        occupation: dto.occupation,
        preferredLanguage: dto.preferredLanguage,
        preferredCurrencyId: dto.preferredCurrencyId,
        timezone: dto.timezone,
        gender: dto.gender,
      },
      include: { preferredCurrency: true },
    });

    const completionStatus = this.computeCompletionStatus(updated);
    if (completionStatus !== updated.profileCompletionStatus) {
      await this.prisma.profile.update({
        where: { id: updated.id },
        data: { profileCompletionStatus: completionStatus },
      });
      updated.profileCompletionStatus = completionStatus;
    }

    return this.toResponseDto({ ...customer, user: { ...customer.user, profile: updated } });
  }

  private computeCompletionStatus(profile: {
    addressLine1: string | null;
    city: string | null;
    addressCountryCode: string | null;
    occupation: string | null;
    preferredCurrencyId: string | null;
  }): 'COMPLETE' | 'INCOMPLETE' {
    const missing = this.missingFields(profile);
    return missing.length === 0 ? 'COMPLETE' : 'INCOMPLETE';
  }

  private missingFields(profile: Record<string, unknown>): string[] {
    return REQUIRED_FOR_COMPLETION.filter((field) => !profile[field]);
  }

  private async findCustomerWithProfile(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { user: { include: { profile: { include: { preferredCurrency: true } } } } },
    });
    if (!customer || !customer.user.profile) {
      throw new NotFoundException('Customer profile not found');
    }
    return customer;
  }

  private toResponseDto(customer: {
    id: string;
    customerNumber: string;
    tier: string;
    status: string;
    user: {
      profile:
        | ({
            firstName: string;
            middleName: string | null;
            lastName: string;
            dateOfBirth: Date;
            gender: string | null;
            addressLine1: string | null;
            addressLine2: string | null;
            city: string | null;
            state: string | null;
            postalCode: string | null;
            addressCountryCode: string | null;
            occupation: string | null;
            preferredLanguage: string;
            timezone: string;
            profileCompletionStatus: string;
            preferredCurrency?: { isoCode: string } | null;
          })
        | null;
    };
  }): CustomerProfileResponseDto {
    const profile = customer.user.profile!;
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
      missingFields: this.missingFields(profile),
    };
  }
}

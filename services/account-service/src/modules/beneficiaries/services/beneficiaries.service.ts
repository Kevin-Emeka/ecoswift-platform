import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { AuditService } from '../../../common/services/audit.service';
import type { CreateBeneficiaryDto, UpdateBeneficiaryDto, BeneficiaryResponseDto } from '../dto/beneficiary.dto';

/**
 * "Verify beneficiary" here is deliberately a simplified, in-app
 * confirmation step (PENDING_VERIFICATION -> ACTIVE), not real
 * bank-account-ownership verification (e.g. micro-deposits, Plaid-style
 * instant verification) — this platform has no real payment rail to run
 * that against. It exists so the UI and status model match a real bank's
 * shape; see `ExternalTransferService` for why the actual money movement
 * this feeds is treated as simulated settlement, not real.
 */
@Injectable()
export class BeneficiariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateBeneficiaryDto): Promise<BeneficiaryResponseDto> {
    const customer = await this.getCustomer(userId);
    const currency = await this.prisma.currency.findUnique({ where: { isoCode: dto.currencyCode.toUpperCase() } });
    if (!currency) {
      throw new BadRequestException(`Unknown currency code "${dto.currencyCode}"`);
    }

    const beneficiary = await this.prisma.beneficiary.create({
      data: {
        customerId: customer.id,
        beneficiaryName: dto.beneficiaryName,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        swiftBic: dto.swiftBic,
        bankAddress: dto.bankAddress,
        bankCountryCode: dto.bankCountryCode,
        routingNumber: dto.routingNumber,
        currencyId: currency.id,
        nickname: dto.nickname,
        status: 'PENDING_VERIFICATION',
      },
      include: { currency: true },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'CREATE',
      resourceType: 'Beneficiary',
      resourceId: beneficiary.id,
      description: `Added beneficiary ${beneficiary.beneficiaryName}`,
      afterState: { beneficiaryName: beneficiary.beneficiaryName, accountNumber: beneficiary.accountNumber },
    });

    return this.toResponseDto(beneficiary);
  }

  async list(userId: string, search?: string): Promise<BeneficiaryResponseDto[]> {
    const customer = await this.getCustomer(userId);
    const beneficiaries = await this.prisma.beneficiary.findMany({
      where: {
        customerId: customer.id,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { beneficiaryName: { contains: search, mode: 'insensitive' } },
                { nickname: { contains: search, mode: 'insensitive' } },
                { accountNumber: { contains: search } },
              ],
            }
          : {}),
      },
      include: { currency: true },
      orderBy: [{ isFavorite: 'desc' }, { beneficiaryName: 'asc' }],
    });
    return beneficiaries.map((b) => this.toResponseDto(b));
  }

  async update(userId: string, beneficiaryId: string, dto: UpdateBeneficiaryDto): Promise<BeneficiaryResponseDto> {
    const beneficiary = await this.loadOwnedBeneficiary(userId, beneficiaryId);
    const updated = await this.prisma.beneficiary.update({
      where: { id: beneficiary.id },
      data: { nickname: dto.nickname, isFavorite: dto.isFavorite },
      include: { currency: true },
    });
    return this.toResponseDto(updated);
  }

  async verify(userId: string, beneficiaryId: string): Promise<BeneficiaryResponseDto> {
    const beneficiary = await this.loadOwnedBeneficiary(userId, beneficiaryId);
    if (beneficiary.status === 'BLOCKED') {
      throw new BadRequestException('This beneficiary is blocked and cannot be verified');
    }
    const updated = await this.prisma.beneficiary.update({
      where: { id: beneficiary.id },
      data: { status: 'ACTIVE' },
      include: { currency: true },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'UPDATE',
      resourceType: 'Beneficiary',
      resourceId: beneficiary.id,
      description: `Verified beneficiary ${beneficiary.beneficiaryName}`,
      beforeState: { status: beneficiary.status },
      afterState: { status: 'ACTIVE' },
    });

    return this.toResponseDto(updated);
  }

  async delete(userId: string, beneficiaryId: string): Promise<void> {
    const beneficiary = await this.loadOwnedBeneficiary(userId, beneficiaryId);
    await this.prisma.beneficiary.update({ where: { id: beneficiary.id }, data: { deletedAt: new Date() } });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'DELETE',
      resourceType: 'Beneficiary',
      resourceId: beneficiary.id,
      description: `Removed beneficiary ${beneficiary.beneficiaryName}`,
    });
  }

  /**
   * Used by `ExternalTransferService` for the inline international-wire
   * flow — a customer fills in the full recipient/bank details directly on
   * the transfer form instead of visiting Beneficiaries first and waiting
   * on the (already-fake, see `verify()`'s doc comment) verification step.
   * Reuses a matching existing beneficiary if one exists (so sending to
   * the same recipient twice doesn't create duplicate rows and the
   * beneficiary's `nickname`/`isFavorite` survive), otherwise creates one
   * — always `ACTIVE` immediately, since the customer just typed these
   * details themselves for this exact transfer, and PENDING_VERIFICATION
   * would only block the very transfer they're trying to make. The
   * created/reused row still shows up on the Beneficiaries page
   * afterwards for reuse — nothing is hidden, it's just no longer a
   * required separate step first.
   */
  async findOrCreateForWire(
    userId: string,
    details: {
      beneficiaryName: string;
      accountNumber: string;
      bankName?: string;
      swiftBic?: string;
      bankAddress?: string;
      bankCountryCode?: string;
      routingNumber?: string;
      currencyCode: string;
    },
  ) {
    const customer = await this.getCustomer(userId);
    const currency = await this.prisma.currency.findUnique({ where: { isoCode: details.currencyCode.toUpperCase() } });
    if (!currency) {
      throw new NotFoundException(`Unknown currency code "${details.currencyCode}"`);
    }

    const existing = await this.prisma.beneficiary.findFirst({
      where: {
        customerId: customer.id,
        accountNumber: details.accountNumber,
        currencyId: currency.id,
        deletedAt: null,
      },
    });

    if (existing) {
      if (existing.status === 'BLOCKED') {
        throw new ForbiddenException('This recipient is blocked and cannot receive transfers');
      }
      return this.prisma.beneficiary.update({
        where: { id: existing.id },
        data: {
          beneficiaryName: details.beneficiaryName,
          bankName: details.bankName,
          swiftBic: details.swiftBic,
          bankAddress: details.bankAddress,
          bankCountryCode: details.bankCountryCode,
          routingNumber: details.routingNumber,
          status: existing.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : existing.status,
        },
      });
    }

    const created = await this.prisma.beneficiary.create({
      data: {
        customerId: customer.id,
        beneficiaryName: details.beneficiaryName,
        accountNumber: details.accountNumber,
        bankName: details.bankName,
        swiftBic: details.swiftBic,
        bankAddress: details.bankAddress,
        bankCountryCode: details.bankCountryCode,
        routingNumber: details.routingNumber,
        currencyId: currency.id,
        status: 'ACTIVE',
      },
    });

    await this.auditService.record({
      actorUserId: userId,
      actorType: 'CUSTOMER',
      actionType: 'CREATE',
      resourceType: 'Beneficiary',
      resourceId: created.id,
      description: `Added recipient ${created.beneficiaryName} via international wire transfer`,
      afterState: { beneficiaryName: created.beneficiaryName, accountNumber: created.accountNumber, swiftBic: details.swiftBic },
    });

    return created;
  }

  private async getCustomer(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    return customer;
  }

  private async loadOwnedBeneficiary(userId: string, beneficiaryId: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: { customer: true },
    });
    if (!beneficiary || beneficiary.deletedAt) {
      throw new NotFoundException('Beneficiary not found');
    }
    if (beneficiary.customer.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return beneficiary;
  }

  private toResponseDto(beneficiary: {
    id: string;
    beneficiaryName: string;
    accountNumber: string;
    bankName: string | null;
    bankCode: string | null;
    swiftBic: string | null;
    bankAddress: string | null;
    bankCountryCode: string | null;
    routingNumber: string | null;
    nickname: string | null;
    isFavorite: boolean;
    status: string;
    createdAt: Date;
    currency: { isoCode: string };
  }): BeneficiaryResponseDto {
    return {
      id: beneficiary.id,
      beneficiaryName: beneficiary.beneficiaryName,
      accountNumber: beneficiary.accountNumber,
      bankName: beneficiary.bankName ?? undefined,
      bankCode: beneficiary.bankCode ?? undefined,
      swiftBic: beneficiary.swiftBic ?? undefined,
      bankAddress: beneficiary.bankAddress ?? undefined,
      bankCountryCode: beneficiary.bankCountryCode ?? undefined,
      routingNumber: beneficiary.routingNumber ?? undefined,
      currencyCode: beneficiary.currency.isoCode,
      nickname: beneficiary.nickname ?? undefined,
      isFavorite: beneficiary.isFavorite,
      status: beneficiary.status,
      createdAt: beneficiary.createdAt.toISOString(),
    };
  }
}

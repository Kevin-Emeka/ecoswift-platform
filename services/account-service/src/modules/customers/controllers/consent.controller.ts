import { Body, Controller, Get, Ip, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { AuditService } from '../../../common/services/audit.service';
import { ConsentService, type ConsentStatus } from '../services/consent.service';
import { RecordConsentDto } from '../dto/record-consent.dto';

@ApiTags('customers')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'customers/me/consents', version: '1' })
export class ConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: "Get the caller's current consent status for each type (Terms & Conditions, Privacy Policy, Marketing)" })
  async getMyConsents(@CurrentUser() user: AuthenticatedUser): Promise<ConsentStatus[]> {
    return this.consentService.currentStatuses(user.userId);
  }

  @Post()
  @RequirePermissions('customers:update')
  @ApiOperation({ summary: 'Record acceptance/withdrawal of a Terms & Conditions, Privacy Policy, or Marketing Communications consent — always appends a new entry, never overwrites' })
  async recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordConsentDto,
    @Ip() ip: string,
  ): Promise<ConsentStatus> {
    const result = await this.consentService.record(user.userId, dto, ip);

    await this.auditService.record({
      actorUserId: user.userId,
      actorType: 'CUSTOMER',
      actionType: dto.accepted ? 'APPROVE' : 'REJECT',
      resourceType: 'CustomerConsent',
      description: `${dto.consentType} v${dto.version} — ${dto.accepted ? 'accepted' : 'withdrawn'}`,
      afterState: result as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    return result;
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import type { PaginatedResult } from '@ecoswift/types';
import { SecurityEventQueryService } from '../services/security-event-query.service';
import { ListSecurityEventsQueryDto } from '../dto/list-security-events-query.dto';
import type { SecurityEventResponseDto } from '../dto/security-event-response.dto';

/**
 * Staff-only — gated by `audit_logs:read` rather than a new
 * `security_events` catalog resource; security events are, for
 * authorization purposes, the same "compliance/security observability
 * read" audience as audit logs (`COMPLIANCE_OFFICER`, `RISK_OFFICER`,
 * `FINANCE_OFFICER`, `AUDITOR`, `SYSTEM_ADMINISTRATOR` all already hold
 * it). Response shape here is unwrapped (no `ApiResponseInterceptor`),
 * matching every other controller already in auth-service — this service
 * predates the wrapped-envelope convention account-service/audit-service
 * introduced in later phases; retrofitting auth-service's existing
 * controllers is out of this milestone's scope.
 */
@ApiTags('security')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller({ path: 'security-events', version: '1' })
export class SecurityEventsController {
  constructor(private readonly securityEventQueryService: SecurityEventQueryService) {}

  @Get()
  @RequirePermissions('audit_logs:read')
  @ApiOperation({ summary: 'Browse/search security events (staff only)' })
  async list(@Query() query: ListSecurityEventsQueryDto): Promise<PaginatedResult<SecurityEventResponseDto>> {
    return this.securityEventQueryService.list(query);
  }
}

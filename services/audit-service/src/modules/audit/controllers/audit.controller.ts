import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import type { PaginatedResult } from '@ecoswift/types';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { AuditQueryService, type ChainVerificationResult } from '../services/audit-query.service';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import type { AuditLogResponseDto } from '../dto/audit-log-response.dto';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get()
  @RequirePermissions('audit_logs:read')
  @ApiOperation({ summary: 'Browse/search audit log entries (staff only)' })
  async list(@Query() query: ListAuditLogsQueryDto): Promise<PaginatedResult<AuditLogResponseDto>> {
    return this.auditQueryService.list(query);
  }

  @Get('verify-chain')
  @RequirePermissions('audit_logs:read')
  @ApiOperation({ summary: 'Verify the audit log hash chain has not been tampered with (staff only)' })
  async verifyChain(): Promise<ChainVerificationResult> {
    return this.auditQueryService.verifyChain();
  }
}

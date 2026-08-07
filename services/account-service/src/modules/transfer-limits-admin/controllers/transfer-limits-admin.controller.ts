import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { TransferLimitsAdminService } from '../services/transfer-limits-admin.service';
import { CreateTransferLimitDto, TransferLimitResponseDto } from '../dto/transfer-limit.dto';

/** Staff-only management of the admin-configurable transfer limits `TransferLimitsService` enforces at transfer time. */
@ApiTags('transfer-limits')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'transfer-limits', version: '1' })
export class TransferLimitsAdminController {
  constructor(private readonly transferLimitsAdminService: TransferLimitsAdminService) {}

  @Get()
  @RequirePermissions('transfer_limits:read')
  @ApiOperation({ summary: 'List every currently-active transfer limit, across all scopes' })
  async list(): Promise<TransferLimitResponseDto[]> {
    return this.transferLimitsAdminService.list();
  }

  @Post()
  @RequirePermissions('transfer_limits:create')
  @ApiOperation({ summary: 'Set a transfer limit for a scope — retires any existing active limit at the same scope+currency first' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTransferLimitDto): Promise<TransferLimitResponseDto> {
    return this.transferLimitsAdminService.create(user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('transfer_limits:delete')
  @ApiOperation({ summary: 'Remove a scoped limit override, reverting to the next broader scope' })
  async retire(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.transferLimitsAdminService.retire(user.userId, id);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { ScheduledTransfersService } from '../services/scheduled-transfers.service';
import { CreateScheduledTransferDto, ScheduledTransferResponseDto } from '../dto/scheduled-transfer.dto';

/** Nested under `/v1/accounts/:accountId/...`, matching `TransfersController`'s convention — creating a schedule is always scoped to one caller-owned source account. */
@ApiTags('accounts')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'accounts/:accountId/scheduled-transfers', version: '1' })
export class ScheduledTransfersController {
  constructor(private readonly scheduledTransfersService: ScheduledTransfersService) {}

  @Post()
  @RequirePermissions('transactions:create')
  @ApiOperation({ summary: 'Schedule a future-dated or recurring transfer from this account' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: CreateScheduledTransferDto,
  ): Promise<ScheduledTransferResponseDto> {
    return this.scheduledTransfersService.create(user.userId, accountId, dto);
  }
}

/** Top-level, like `BeneficiariesController` — listing/cancelling isn't scoped to any one account, it spans every account the customer owns. */
@ApiTags('scheduled-transfers')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'scheduled-transfers', version: '1' })
export class ScheduledTransfersQueryController {
  constructor(private readonly scheduledTransfersService: ScheduledTransfersService) {}

  @Get()
  @RequirePermissions('transactions:read')
  @ApiOperation({ summary: "List the caller's scheduled transfers across all accounts (pending first)" })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ScheduledTransferResponseDto[]> {
    return this.scheduledTransfersService.list(user.userId);
  }

  @Delete(':scheduledTransferId')
  @HttpCode(204)
  @RequirePermissions('transactions:create')
  @ApiOperation({ summary: 'Cancel a scheduled transfer before it processes' })
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param('scheduledTransferId') scheduledTransferId: string): Promise<void> {
    await this.scheduledTransfersService.cancel(user.userId, scheduledTransferId);
  }
}

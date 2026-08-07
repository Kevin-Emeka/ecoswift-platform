import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { TransferReviewService } from '../services/transfer-review.service';
import {
  ApproveTransferDto,
  ListTransferReviewsQueryDto,
  RejectTransferDto,
  TransferReviewDetailDto,
  TransferReviewListItemDto,
} from '../dto/transfer-review.dto';

/**
 * Staff-only queue for resolving transfers `InternalTransferService`/
 * `ExternalTransferService` held for manual review. Not nested under
 * `/accounts/:accountId` like the customer-facing transfer endpoints —
 * this spans every account across the bank, the same top-level shape as
 * `StaffController`/`ScheduledTransfersQueryController`.
 */
@ApiTags('transfer-review')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'transfer-reviews', version: '1' })
export class TransferReviewController {
  constructor(private readonly transferReviewService: TransferReviewService) {}

  @Get()
  @RequirePermissions('transactions:approve')
  @ApiOperation({ summary: 'List transfers held for review, filterable by resolution status (defaults to PENDING)' })
  async list(@Query() query: ListTransferReviewsQueryDto): Promise<TransferReviewListItemDto[]> {
    return this.transferReviewService.list(query.status);
  }

  @Get(':transactionId')
  @RequirePermissions('transactions:approve')
  @ApiOperation({ summary: 'View a held transfer in detail, including the fraud signals that triggered the hold' })
  async getById(@Param('transactionId') transactionId: string): Promise<TransferReviewDetailDto> {
    return this.transferReviewService.getById(transactionId);
  }

  @Post(':transactionId/approve')
  @RequirePermissions('transactions:approve')
  @ApiOperation({ summary: 'Approve a held transfer — posts it through the same ledger workflow a normal transfer takes' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
    @Body() dto: ApproveTransferDto,
  ): Promise<TransferReviewDetailDto> {
    return this.transferReviewService.approve(user.userId, transactionId, dto.comments);
  }

  @Post(':transactionId/reject')
  @RequirePermissions('transactions:reject')
  @ApiOperation({ summary: 'Reject a held transfer — no ledger entries are posted, the customer is notified' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
    @Body() dto: RejectTransferDto,
  ): Promise<TransferReviewDetailDto> {
    return this.transferReviewService.reject(user.userId, transactionId, dto.reason);
  }
}

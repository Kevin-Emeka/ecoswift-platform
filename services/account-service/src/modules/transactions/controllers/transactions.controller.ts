import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { SandboxTransactionService } from '../services/sandbox-transaction.service';
import { TransactionQueryService } from '../services/transaction-query.service';
import { SandboxDepositDto, SandboxWithdrawalDto } from '../dto/sandbox-transaction.dto';
import { TransactionResponseDto } from '../dto/transaction-response.dto';

/**
 * Every endpoint here operates strictly within the sandbox — see
 * `SandboxTransactionService`'s doc comment. Nested under `/v1/accounts`
 * (not a top-level `/v1/transactions`) since every operation is always
 * scoped to one caller-owned account; there is no cross-account
 * transaction listing in this milestone.
 */
@ApiTags('accounts')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'accounts/:accountId/transactions', version: '1' })
export class TransactionsController {
  constructor(
    private readonly sandboxTransactionService: SandboxTransactionService,
    private readonly transactionQueryService: TransactionQueryService,
  ) {}

  @Get()
  @RequirePermissions('transactions:read')
  @ApiOperation({ summary: 'Transaction history for an account the caller owns (sandbox transactions only)' })
  async list(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string): Promise<TransactionResponseDto[]> {
    return this.transactionQueryService.listForAccount(user.userId, accountId);
  }

  @Post('deposit')
  @RequirePermissions('transactions:create')
  @ApiOperation({ summary: 'Simulate a deposit into an account the caller owns — sandbox only, no real funds move' })
  async deposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: SandboxDepositDto,
  ): Promise<TransactionResponseDto> {
    return this.sandboxTransactionService.deposit(user.userId, accountId, dto.amount, dto.description);
  }

  @Post('withdraw')
  @RequirePermissions('transactions:create')
  @ApiOperation({ summary: 'Simulate a withdrawal from an account the caller owns — sandbox only, no real funds move' })
  async withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: SandboxWithdrawalDto,
  ): Promise<TransactionResponseDto> {
    return this.sandboxTransactionService.withdraw(user.userId, accountId, dto.amount, dto.description);
  }
}

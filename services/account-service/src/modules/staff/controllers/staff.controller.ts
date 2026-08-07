import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { StaffCustomerService } from '../services/staff-customer.service';
import { StaffAccountService } from '../services/staff-account.service';
import { SandboxTransactionService } from '../../transactions/services/sandbox-transaction.service';
import { ListCustomersQueryDto, ListAccountsQueryDto } from '../dto/list-query.dto';
import { AdminCreditDto } from '../dto/admin-credit.dto';
import type { PaginatedCustomerSummary, PaginatedAccountSummary } from '../dto/staff-summary-response.dto';
import type { CustomerProfileResponseDto } from '../../customers/dto/customer-profile-response.dto';
import type { AccountSummaryDto } from '../dto/staff-summary-response.dto';
import type { TransactionResponseDto } from '../../transactions/dto/transaction-response.dto';

@ApiTags('staff')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'staff', version: '1' })
export class StaffController {
  constructor(
    private readonly staffCustomerService: StaffCustomerService,
    private readonly staffAccountService: StaffAccountService,
    private readonly sandboxTransactionService: SandboxTransactionService,
  ) {}

  @Get('customers')
  @RequirePermissions('customers:list')
  @ApiOperation({ summary: 'Browse/search customers across the bank (staff only)' })
  async listCustomers(@Query() query: ListCustomersQueryDto): Promise<PaginatedCustomerSummary> {
    return this.staffCustomerService.list(query);
  }

  @Get('customers/:customerId')
  @RequirePermissions('customers:list')
  @ApiOperation({ summary: 'Get any customer by id (staff only)' })
  async getCustomer(@Param('customerId') customerId: string): Promise<CustomerProfileResponseDto> {
    return this.staffCustomerService.getById(customerId);
  }

  @Get('accounts')
  @RequirePermissions('accounts:list')
  @ApiOperation({ summary: 'Browse/search accounts across all customers (staff only)' })
  async listAccounts(@Query() query: ListAccountsQueryDto): Promise<PaginatedAccountSummary> {
    return this.staffAccountService.list(query);
  }

  @Get('accounts/:accountId')
  @RequirePermissions('accounts:list')
  @ApiOperation({ summary: 'Get any account by id (staff only)' })
  async getAccount(@Param('accountId') accountId: string): Promise<AccountSummaryDto> {
    return this.staffAccountService.getById(accountId);
  }

  @Post('accounts/:accountId/credit')
  @RequirePermissions('accounts:credit')
  @ApiOperation({
    summary:
      'Credit funds directly into any customer\'s existing account (staff only, sandbox-only) — e.g. backfilling an opening balance a customer could not self-declare at account opening',
  })
  async creditAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: AdminCreditDto,
  ): Promise<TransactionResponseDto> {
    // `accounts:credit` is only ever granted to staff roles (see
    // PERMISSION_CATALOG/ROLE_CATALOG — CUSTOMER never has it), but this
    // mirrors every other sensitive action in this service by asserting
    // actorType explicitly too, rather than trusting the permission grant
    // alone to never be misconfigured later.
    if (user.actorType === 'CUSTOMER') {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return this.sandboxTransactionService.adminCredit(user.userId, accountId, dto.amount, dto.reason);
  }
}

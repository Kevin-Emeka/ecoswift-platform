import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { PrismaService } from '@ecoswift/database';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { AccountService } from '../services/account.service';
import { AccountStatusService } from '../services/account-status.service';
import { OpenAccountDto } from '../dto/open-account.dto';
import { AccountStatusActionDto } from '../dto/account-status-action.dto';
import { AccountResponseDto } from '../dto/account-response.dto';

/**
 * Ownership + permission design (docs/account-opening.md § Authorization):
 * `@RequirePermissions` alone isn't enough to gate some of these actions
 * because a handful of permissions (`accounts:freeze`, `accounts:update`)
 * are deliberately granted to `CUSTOMER` too, for self-service (freeze
 * your own account). `assertOwnerOrStaff`/`assertStaff` add the missing
 * check on top: `actorType`, not a permission, decides whether the caller
 * is staff — matching real banking practice (you can freeze your own card
 * instantly; un-freezing, closing, restricting, and marking dormant need a
 * human on the bank's side, not just "holds the right permission string").
 */
@ApiTags('accounts')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(
    private readonly accountService: AccountService,
    private readonly accountStatusService: AccountStatusService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions('accounts:read')
  @ApiOperation({ summary: "List the caller's own accounts" })
  async listMyAccounts(@CurrentUser() user: AuthenticatedUser): Promise<AccountResponseDto[]> {
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { userId: user.userId } });
    return this.accountService.listForCustomer(customer.id);
  }

  @Get(':accountId')
  @RequirePermissions('accounts:read')
  @ApiOperation({ summary: 'Get a single account — the owning customer, or staff holding accounts:close' })
  async getAccount(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string): Promise<AccountResponseDto> {
    await this.assertOwnerOrStaff(user, accountId);
    return this.accountService.getById(accountId);
  }

  @Post()
  @RequirePermissions('accounts:create')
  @ApiOperation({ summary: 'Open a new account (Savings, Current, Fixed Deposit, or Business) for the caller\'s own customer record' })
  async openAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenAccountDto): Promise<AccountResponseDto> {
    return this.accountService.open(user.userId, dto);
  }

  @Post(':accountId/activate')
  @RequirePermissions('accounts:update')
  @ApiOperation({ summary: 'Activate a pending account — staff only (a newly-opened account is not usable until reviewed and activated by staff)' })
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: AccountStatusActionDto,
  ) {
    this.assertStaff(user);
    return this.accountStatusService.transition(accountId, 'ACTIVE', this.actorFor(user), dto.reason);
  }

  @Post(':accountId/freeze')
  @RequirePermissions('accounts:freeze')
  @ApiOperation({ summary: 'Freeze an account — self-service for the owning customer, or staff holding accounts:close' })
  async freeze(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string, @Body() dto: AccountStatusActionDto) {
    await this.assertOwnerOrStaff(user, accountId);
    return this.accountStatusService.transition(accountId, 'FROZEN', this.actorFor(user), dto.reason);
  }

  @Post(':accountId/unfreeze')
  @RequirePermissions('accounts:unfreeze')
  @ApiOperation({ summary: 'Unfreeze an account — staff only (accounts:unfreeze is not granted to CUSTOMER)' })
  async unfreeze(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string, @Body() dto: AccountStatusActionDto) {
    return this.accountStatusService.transition(accountId, 'ACTIVE', this.actorFor(user), dto.reason);
  }

  @Post(':accountId/close')
  @RequirePermissions('accounts:close')
  @ApiOperation({ summary: 'Close an account — staff only (accounts:close is not granted to CUSTOMER)' })
  async close(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string, @Body() dto: AccountStatusActionDto) {
    return this.accountStatusService.transition(accountId, 'CLOSED', this.actorFor(user), dto.reason);
  }

  @Post(':accountId/restrict')
  @RequirePermissions('accounts:freeze')
  @ApiOperation({ summary: 'Restrict an account (compliance/risk hold) — staff only' })
  async restrict(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string, @Body() dto: AccountStatusActionDto) {
    this.assertStaff(user);
    return this.accountStatusService.transition(accountId, 'RESTRICTED', this.actorFor(user), dto.reason);
  }

  @Post(':accountId/unrestrict')
  @RequirePermissions('accounts:unfreeze')
  @ApiOperation({ summary: 'Lift a restriction — staff only' })
  async unrestrict(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string, @Body() dto: AccountStatusActionDto) {
    return this.accountStatusService.transition(accountId, 'ACTIVE', this.actorFor(user), dto.reason);
  }

  @Post(':accountId/mark-dormant')
  @RequirePermissions('accounts:update')
  @ApiOperation({ summary: 'Mark an inactive account dormant — staff only (no inactivity batch job exists yet; this is the manual equivalent)' })
  async markDormant(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string, @Body() dto: AccountStatusActionDto) {
    this.assertStaff(user);
    return this.accountStatusService.transition(accountId, 'DORMANT', this.actorFor(user), dto.reason);
  }

  @Post(':accountId/reactivate')
  @RequirePermissions('accounts:update')
  @ApiOperation({ summary: 'Reactivate a dormant account — self-service for the owning customer, or staff holding accounts:close' })
  async reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Body() dto: AccountStatusActionDto,
  ) {
    await this.assertOwnerOrStaff(user, accountId);
    return this.accountStatusService.transition(accountId, 'ACTIVE', this.actorFor(user), dto.reason);
  }

  private actorFor(user: AuthenticatedUser): { userId: string; actorType: 'CUSTOMER' | 'STAFF' } {
    return { userId: user.userId, actorType: user.actorType === 'CUSTOMER' ? 'CUSTOMER' : 'STAFF' };
  }

  /**
   * "Staff" here means "not a self-service customer" (`actorType`), not a
   * specific permission — `@RequirePermissions` on the route already
   * guarantees the caller holds the action's permission (e.g.
   * `accounts:freeze`), but that same permission is deliberately granted
   * to `CUSTOMER` too for self-service (freeze your own account). This
   * check is what stops that self-service grant from letting a customer
   * act on an account they don't own.
   */
  private async assertOwnerOrStaff(user: AuthenticatedUser, accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, include: { customer: true } });
    if (!account) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    const isOwner = account.customer.userId === user.userId;
    if (!isOwner && user.actorType === 'CUSTOMER') {
      throw new ForbiddenException('You do not have access to this resource');
    }
  }

  private assertStaff(user: AuthenticatedUser): void {
    if (user.actorType === 'CUSTOMER') {
      throw new ForbiddenException('You do not have access to this resource');
    }
  }
}

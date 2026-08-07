import { Body, Controller, ForbiddenException, Get, Param, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, PolicyEngineService, RequirePermissions } from '@ecoswift/authz';
import { PrismaService } from '@ecoswift/database';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseInterceptor } from '../../../interceptors/api-response.interceptor';
import { AuditService } from '../../../common/services/audit.service';
import { CustomerProfileService } from '../services/customer-profile.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateCustomerStatusDto } from '../dto/update-customer-status.dto';
import { CustomerProfileResponseDto } from '../dto/customer-profile-response.dto';

@ApiTags('customers')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@UseInterceptors(ApiResponseInterceptor)
@Controller({ path: 'customers', version: '1' })
export class CustomerProfileController {
  constructor(
    private readonly profileService: CustomerProfileService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  @Get('me')
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: "Get the caller's own customer profile, including completion status" })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser): Promise<CustomerProfileResponseDto> {
    return this.profileService.getByUserId(user.userId);
  }

  @Patch('me')
  @RequirePermissions('customers:update')
  @ApiOperation({ summary: 'Update the caller\'s own profile — address, occupation, preferred language/currency, timezone' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<CustomerProfileResponseDto> {
    const before = await this.profileService.getByUserId(user.userId);
    const updated = await this.profileService.updateByUserId(user.userId, dto);

    await this.auditService.record({
      actorUserId: user.userId,
      actorType: 'CUSTOMER',
      actionType: 'UPDATE',
      resourceType: 'CustomerProfile',
      resourceId: updated.customerId,
      beforeState: before as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  @Patch(':customerId/status')
  @RequirePermissions('customers:update')
  @ApiOperation({
    summary: 'Update a customer\'s status (self-service self-deactivation, or staff action on any customer with customers:delete)',
  })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerStatusDto,
  ): Promise<{ customerId: string; status: string }> {
    const before = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });

    // Ownership check beyond RBAC (docs/authorization.md § Ownership
    // Checks): a caller may change their own status (e.g. self-service
    // closure request), or any customer's status if they separately hold
    // `customers:delete` — a staff-only grant in the permission catalog,
    // reused here as the "may act on someone else's record" bypass rather
    // than inventing a new permission code for this one action.
    const isSelf = before.userId === user.userId;
    if (!isSelf && !(await this.policyEngine.can(user.userId, 'customers:delete'))) {
      throw new ForbiddenException('You do not have access to this resource');
    }

    const updated = await this.prisma.customer.update({ where: { id: customerId }, data: { status: dto.status } });

    await this.auditService.record({
      actorUserId: user.userId,
      actorType: 'CUSTOMER',
      actionType: 'UPDATE',
      resourceType: 'Customer',
      resourceId: customerId,
      description: dto.reason,
      beforeState: { status: before.status },
      afterState: { status: updated.status },
    });

    return { customerId: updated.id, status: updated.status };
  }
}

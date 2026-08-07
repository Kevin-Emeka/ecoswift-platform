import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MessageResponseDto } from '../../auth/dto/message-response.dto';
import { UserRoleService } from '../services/user-role.service';
import { AssignRoleDto } from '../dto/assign-role.dto';

/**
 * Role assignment — see `RoleAssignmentApprovalService`/
 * `role-assignment-approvals.controller.ts` for what happens after
 * `assign()` returns `PENDING_APPROVAL` for a sensitive role.
 */
@ApiTags('authorization')
@ApiBearerAuth('access-token')
@Controller({ path: 'user-roles', version: '1' })
@UseGuards(PermissionsGuard)
export class UserRolesController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Get(':userId')
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: "Permission Inspection — a user's held roles and effective permission set" })
  async listForUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userRoleService.listForUser(userId);
  }

  @Post()
  @RequirePermissions('roles:assign')
  @ApiOperation({ summary: 'Assign a role to a user — sensitive roles route to maker-checker approval instead of taking effect immediately' })
  async assign(@Body() dto: AssignRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.userRoleService.assign(dto.userId, dto.roleId, user.userId);
  }

  @Delete(':userId/:roleId')
  @RequirePermissions('roles:revoke')
  @ApiOperation({ summary: 'Revoke a role from a user' })
  async revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.userRoleService.revoke(userId, roleId, user.userId);
    return { message: 'Role revoked.' };
  }
}

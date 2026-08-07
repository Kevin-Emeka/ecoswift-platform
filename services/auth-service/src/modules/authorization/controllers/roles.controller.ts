import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MessageResponseDto } from '../../auth/dto/message-response.dto';
import { RoleService } from '../services/role.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { GrantPermissionDto } from '../dto/grant-permission.dto';

/**
 * Role Management APIs (docs/rbac.md, docs/authorization.md § Administration).
 * Every endpoint here is itself gated by `@RequirePermissions('roles:*')` —
 * this module enforces the same authorization it implements, on itself.
 */
@ApiTags('authorization')
@ApiBearerAuth('access-token')
@Controller({ path: 'roles', version: '1' })
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'List all roles' })
  async list() {
    return this.roleService.list();
  }

  @Get(':id')
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'Get a role and its permissions' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.getById(id);
  }

  @Get(':id/audit-history')
  @RequirePermissions('roles:read', 'audit_logs:read')
  @ApiOperation({ summary: 'Role Audit History — every recorded change to this role' })
  async auditHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.auditHistory(id);
  }

  @Post()
  @RequirePermissions('roles:create')
  @ApiOperation({ summary: 'Create a custom role' })
  async create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roleService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('roles:update')
  @ApiOperation({ summary: 'Update a role\'s description, hierarchy parent, or sensitivity' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.roleService.update(id, dto, user.userId);
    return { message: 'Role updated.' };
  }

  @Delete(':id')
  @RequirePermissions('roles:delete')
  @ApiOperation({ summary: 'Delete a non-system role with no active assignments' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.roleService.delete(id, user.userId);
    return { message: 'Role deleted.' };
  }

  @Post(':id/permissions')
  @RequirePermissions('roles:update')
  @ApiOperation({ summary: 'Grant a permission to a role' })
  async grantPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.roleService.grantPermission(id, dto.resource, dto.action, user.userId);
    return { message: 'Permission granted.' };
  }

  @Delete(':id/permissions/:resource/:action')
  @RequirePermissions('roles:update')
  @ApiOperation({ summary: 'Revoke a permission from a role' })
  async revokePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('resource') resource: string,
    @Param('action') action: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.roleService.revokePermission(id, resource, action, user.userId);
    return { message: 'Permission revoked.' };
  }
}

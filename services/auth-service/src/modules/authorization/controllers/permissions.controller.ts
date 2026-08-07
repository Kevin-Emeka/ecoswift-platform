import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { PermissionService } from '../services/permission.service';

@ApiTags('authorization')
@ApiBearerAuth('access-token')
@Controller({ path: 'permissions', version: '1' })
@UseGuards(PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'List every grantable permission in the catalog' })
  async list() {
    return this.permissionService.list();
  }

  @Get('groups')
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'Permission Groups — the catalog grouped by resource' })
  async groups() {
    return this.permissionService.groups();
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, RequirePermissions } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { FeatureFlagAdminService } from '../services/feature-flag-admin.service';
import { CreateFeatureFlagDto, ToggleFeatureFlagDto, UpdateFeatureFlagDto } from '../dto/feature-flag.dto';

@ApiTags('authorization')
@ApiBearerAuth('access-token')
@Controller({ path: 'feature-flags', version: '1' })
@UseGuards(PermissionsGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlagAdmin: FeatureFlagAdminService) {}

  @Get()
  @RequirePermissions('feature_flags:read')
  @ApiOperation({ summary: 'List feature flags' })
  async list() {
    return this.featureFlagAdmin.list();
  }

  @Post()
  @RequirePermissions('feature_flags:create')
  @ApiOperation({ summary: 'Create a feature flag' })
  async create(@Body() dto: CreateFeatureFlagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.featureFlagAdmin.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('feature_flags:update')
  @ApiOperation({ summary: 'Update a feature flag' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeatureFlagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.featureFlagAdmin.update(id, dto, user.userId);
  }

  @Post(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('feature_flags:toggle')
  @ApiOperation({ summary: 'Enable/disable a feature flag' })
  async toggle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ToggleFeatureFlagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.featureFlagAdmin.toggle(id, dto.isEnabled, user.userId);
  }
}

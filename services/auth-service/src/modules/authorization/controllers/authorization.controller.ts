import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PolicyEngineService, PERMISSION_RESOLVER, type PermissionResolverPort } from '@ecoswift/authz';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { CheckPermissionDto } from '../dto/check-permission.dto';

/**
 * Self-service permission introspection — no `@RequirePermissions()` here
 * deliberately: any authenticated caller may ask "what can *I* do" and
 * "can *I* do X" about themselves. Inspecting *another* user's roles/
 * permissions is `GET /v1/user-roles/:userId` instead (`roles:read`
 * required) — a different endpoint, a different trust boundary.
 */
@ApiTags('authorization')
@ApiBearerAuth('access-token')
@Controller({ path: 'authorization', version: '1' })
export class AuthorizationController {
  constructor(
    private readonly policyEngine: PolicyEngineService,
    @Inject(PERMISSION_RESOLVER) private readonly permissionResolver: PermissionResolverPort,
  ) {}

  @Get('me/permissions')
  @ApiOperation({ summary: "The caller's own effective permission set" })
  async myPermissions(@CurrentUser() user: AuthenticatedUser) {
    const permissions = await this.permissionResolver.getEffectivePermissions(user.userId);
    return { permissions: [...permissions].sort() };
  }

  @Post('check')
  @ApiOperation({ summary: 'Permission Inspection — does the caller hold every listed permission' })
  async check(@Body() dto: CheckPermissionDto, @CurrentUser() user: AuthenticatedUser) {
    const allowed = await this.policyEngine.canAll(user.userId, dto.permissions);
    return { allowed, permissions: dto.permissions };
  }
}

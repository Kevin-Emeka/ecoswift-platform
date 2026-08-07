import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PolicyEngineService } from '../services/policy-engine.service';
import type { AuthorizedRequest } from '../interfaces/authorized-request.interface';

/**
 * Enforces `@RequirePermissions(...)`. Applied per-route (or per-controller),
 * not globally — a service composes it onto exactly the routes that need a
 * permission check, the same way `auth-service`'s `JwtAuthGuard` is the one
 * applied globally for authentication. Must run **after** whatever guard
 * populates `request.user` (e.g. `JwtAuthGuard`) — `@UseGuards(JwtAuthGuard,
 * PermissionsGuard)` order matters, Nest runs guards left to right.
 *
 * A route with no `@RequirePermissions()` metadata at all is allowed
 * through (an empty requirement list is trivially satisfied) — this guard
 * only ever *adds* a restriction, it never substitutes for authentication.
 * Every other outcome is deny: no `request.user` (not authenticated), or
 * missing any one of the required codes.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication is required for this action');
    }

    const allowed = await this.policyEngine.canAll(request.user.userId, required);
    if (!allowed) {
      throw new ForbiddenException(`Missing required permission(s): ${required.join(', ')}`);
    }
    return true;
  }
}

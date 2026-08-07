import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_OWNERSHIP_KEY, type OwnershipOptions } from '../decorators/require-ownership.decorator';
import { PolicyEngineService } from '../services/policy-engine.service';
import type { AuthorizedRequest } from '../interfaces/authorized-request.interface';

/**
 * Enforces `@RequireOwnership(...)` — resource-level authorization on top
 * of RBAC. A route with no `@RequireOwnership()` metadata is allowed
 * through unchanged (this guard, like `PermissionsGuard`, only ever adds a
 * restriction). Deny is the outcome for every failure mode: no
 * `request.user`, `resolveOwnerId` returning `undefined` (resource not
 * found — never treated as "no check needed"), or an owner mismatch with
 * no bypass permission held.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<OwnershipOptions | undefined>(REQUIRE_OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) return true;

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication is required for this action');
    }

    if (options.bypassPermission && (await this.policyEngine.can(request.user.userId, options.bypassPermission))) {
      return true;
    }

    const ownerId = await options.resolveOwnerId(request);
    if (!ownerId || ownerId !== request.user.userId) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return true;
  }
}

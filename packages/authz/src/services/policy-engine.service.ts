import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PERMISSION_RESOLVER, type PermissionResolverPort } from '../interfaces/permission-resolver.port';

/**
 * The single place authorization *decisions* get made — every guard in
 * this package (`PermissionsGuard`, `OwnershipGuard`) delegates to this
 * rather than querying `PermissionResolverPort` directly, and any service
 * method that needs an authorization answer outside of an HTTP request
 * (a background job, a queue consumer, the `POST /authorization/check`
 * introspection endpoint) can call it the same way a guard does.
 *
 * Default-deny is structural here, not a convention to remember: every
 * public method starts from "no," and the only way to get "yes" is an
 * explicit, resolved grant. A resolver failure is treated identically to
 * "no permissions" — this service never lets an infrastructure error
 * (a DB hiccup, a cache miss gone wrong) fail open into an allow.
 */
@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  constructor(@Inject(PERMISSION_RESOLVER) private readonly resolver: PermissionResolverPort) {}

  async can(userId: string, permission: string): Promise<boolean> {
    return this.canAll(userId, [permission]);
  }

  /** AND semantics — every listed permission must be present. This is `PermissionsGuard`'s default (`@RequirePermissions` requires all listed codes). */
  async canAll(userId: string, permissions: string[]): Promise<boolean> {
    if (permissions.length === 0) return true;
    const effective = await this.safeResolve(userId);
    return permissions.every((permission) => effective.has(permission));
  }

  /** OR semantics — at least one listed permission must be present. */
  async canAny(userId: string, permissions: string[]): Promise<boolean> {
    if (permissions.length === 0) return true;
    const effective = await this.safeResolve(userId);
    return permissions.some((permission) => effective.has(permission));
  }

  /** Throws `ForbiddenException` rather than returning a boolean — for call sites (service methods, not guards) that want to fail the request outright rather than branch on the result themselves. */
  async assertCan(userId: string, permission: string): Promise<void> {
    if (!(await this.can(userId, permission))) {
      throw new ForbiddenException(`Missing required permission: ${permission}`);
    }
  }

  private async safeResolve(userId: string): Promise<Set<string>> {
    try {
      return await this.resolver.getEffectivePermissions(userId);
    } catch (error) {
      this.logger.error(`Failed to resolve effective permissions for user ${userId} — denying by default`, error as Error);
      return new Set();
    }
  }
}

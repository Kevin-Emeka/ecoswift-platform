import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'authz:require-permissions';

/**
 * Gates a route behind `PermissionsGuard` — the caller's effective
 * permission set (docs/rbac.md) must include **every** listed code (AND
 * semantics; there is no built-in OR — a route needing "any of" should
 * call `PolicyEngineService.canAny()` itself rather than relying on this
 * decorator). A route with no `@RequirePermissions()` at all is not
 * exempted by `PermissionsGuard` — it's simply not this guard's concern;
 * pair it with `@Public()` (`@ecoswift/shared`) or another guard as
 * appropriate for that route.
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

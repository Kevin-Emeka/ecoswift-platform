import { SetMetadata } from '@nestjs/common';
import type { AuthorizedRequest } from '../interfaces/authorized-request.interface';

export const REQUIRE_OWNERSHIP_KEY = 'authz:require-ownership';

export interface OwnershipOptions {
  /** Given the request, returns the id of whoever owns the resource being accessed — return `undefined` if the resource doesn't exist (the guard then denies, it never treats "unknown owner" as "no owner check needed"). */
  resolveOwnerId: (request: AuthorizedRequest) => string | undefined | Promise<string | undefined>;
  /** Holding this permission lets the caller bypass the ownership check entirely — the staff-role "view any customer's data" case (security-model.md's authorization flow step (c)). Omit for a resource nobody may access on another's behalf. */
  bypassPermission?: string;
}

/**
 * Gates a route behind `OwnershipGuard` — resource-level authorization
 * beyond RBAC (docs/authorization.md § Ownership Checks): even a caller
 * with the right *kind* of permission (e.g. `accounts:read`) must also
 * either own the specific resource or hold `bypassPermission`.
 */
export const RequireOwnership = (options: OwnershipOptions) => SetMetadata(REQUIRE_OWNERSHIP_KEY, options);

import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SCOPES_KEY = 'authz:require-scopes';

/**
 * Gates a route behind `ApiKeyGuard` — the presented API key's `scopes[]`
 * (`prisma/schema.prisma`'s `ApiKey.scopes`) must include every listed
 * scope. Scopes and RBAC permissions share the same `resource:action`
 * naming convention (docs/authorization.md § Scope-Based Authorization)
 * but are checked independently — a scope is a property of the *key*
 * presented, not of a signed-in user's roles.
 */
export const RequireScopes = (...scopes: string[]) => SetMetadata(REQUIRE_SCOPES_KEY, scopes);

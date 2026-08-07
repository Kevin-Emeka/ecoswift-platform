# Ecoswift Bank — Authorization & Access Control

**Phase 3B deliverable.** How access is actually enforced at request time: the permission guard, resource-level ownership checks, the policy engine, scope-based (API key) authorization, and feature flag gating. Built as a standalone, reusable package — `@ecoswift/authz` — specifically so that every *other* service (accounts, transactions, loans, ...) can import the same guards and enforce the same permission catalog against its own endpoints in a later phase, without depending on `auth-service` directly.

Companion documents: [`rbac.md`](rbac.md) (the role/permission model itself), [`permission-matrix.md`](permission-matrix.md) (the generated full grid), [`compliance-controls.md`](compliance-controls.md) (audit logging, approval hooks, everything compliance-facing).

Out of scope for this phase, per the Phase 3B brief: customer dashboard, transfers, loans, savings, KYC workflow, receipt generation, and every other actual banking operation. This phase builds the authorization *mechanism* and manages it against itself (roles, permissions, API keys, feature flags) — there are no protected banking resources yet for it to gate, because those resources don't exist yet.

---

## Where this lives

- **`packages/authz`** (`@ecoswift/authz`) — the reusable primitives: the permission catalog, `PermissionsGuard`, `OwnershipGuard`, `ApiKeyGuard`, `FeatureFlagGuard`, their matching decorators, `PolicyEngineService`, and `PermissionResolverService`. Depends only on `@ecoswift/database`, `@ecoswift/cache`, `@ecoswift/config`, and `@ecoswift/shared` — no dependency on `auth-service` itself, by design.
- **`services/auth-service`'s `modules/authorization/`** — the administration surface built on top of those primitives: role/permission/API-key/feature-flag CRUD, role assignment, and the maker-checker approval queue. This is where Role Management APIs, Permission Assignment APIs, etc. actually live.

A future service wanting to gate its own endpoints imports `AuthzModule` from `@ecoswift/authz`, decorates its routes with `@RequirePermissions(...)`, and gets the same enforcement `auth-service` uses on itself — it does not need to call `auth-service` over the network to check a permission, because `PermissionResolverService` reads `Role`/`Permission`/`UserRole` directly from the shared database every other service already has a `PrismaService` connection to (Phase 2B's single-shared-schema architecture, `database-architecture.md`).

## Permission Guards

`PermissionsGuard` + `@RequirePermissions(...codes)`. Reads the caller's effective permission set (`PolicyEngineService` → `PermissionResolverService`, cached 30s, invalidated immediately on any role/permission write — see `rbac.md`) and requires **every** listed code (AND semantics — a route needing "any of" calls `PolicyEngineService.canAny()` directly rather than relying on the decorator). Applied per-route/per-controller, not globally — a route with no `@RequirePermissions()` is simply not this guard's concern, the same way a route with no `@RequirePermissions()` metadata passes through unexamined.

**Default deny is structural, not conventional**: no `request.user` → `401`; missing any required code → `403`; a `PermissionResolverService` failure (a DB hiccup, a cache error) → treated as zero permissions, never as an allow (`PolicyEngineService.safeResolve()`'s explicit job). There is no code path in this package where an infrastructure error produces an authorization *grant*.

## Least Privilege Principle

Not a single artifact — it's the design constraint the whole seeded catalog was built against (`rbac.md`'s per-role reasoning) and something `permission-catalog.spec.ts` actively tests: `CUSTOMER` is asserted to hold zero staff-only-resource permissions, `AUDITOR` is asserted to hold zero non-read/export permissions, `SYSTEM_ADMINISTRATOR` deliberately excludes every banking-data permission (accounts, transactions, loans, ...) even though it can manage every *user and role* — technical administration and business-data access are kept as separate concerns on purpose.

## Ownership Checks / Resource-Level Authorization

`OwnershipGuard` + `@RequireOwnership({ resolveOwnerId, bypassPermission? })` — authorization beyond "does this role have this kind of permission at all." A route supplies a function that resolves the specific resource's owner id from the request; the guard denies unless the caller *is* that owner, or holds `bypassPermission` (the staff "view any customer's data" case — `security-model.md`'s authorization-flow step (c) realized in code). `resolveOwnerId` returning `undefined` (resource doesn't exist) is never treated as "no check needed" — it denies, same as an actual mismatch.

This phase has no real protected resource to attach `@RequireOwnership()` to yet (no accounts, no transactions), so the mechanism is proven at the guard level — `ownership.guard.spec.ts` covers owner-match, owner-mismatch, missing-resource, and both branches of the bypass-permission path — ready for the first real resource-owning service to apply it directly.

## Policy Engine

`PolicyEngineService` — the one place an authorization *decision* gets made, so both HTTP guards and non-HTTP call sites (a background job, a queue consumer, the introspection endpoint below) ask the same question the same way rather than each re-implementing "does this user have this permission":

- `can(userId, permission)` / `canAll(userId, permissions[])` (AND) / `canAny(userId, permissions[])` (OR)
- `assertCan(userId, permission)` — throws `ForbiddenException` for call sites that want to fail outright rather than branch on a boolean.

`PermissionsGuard` and `OwnershipGuard` both delegate to this rather than querying `PermissionResolverPort` directly.

## Scope-Based Authorization (API keys)

The machine-client counterpart to session-based RBAC. `ApiKeyGuard` + `@RequireScopes(...)` reads the `X-API-Key` header, validates it (`ApiKeyValidatorService` — looks the key up by the SHA-256 hash of the raw value presented, the same never-persist-the-secret pattern `TokenService`/`OtpService` use for tokens and OTPs in `authentication.md`), and requires every listed scope to be present in `ApiKey.scopes`. Scopes share the exact `resource:action` vocabulary permissions use (`CreateApiKeyDto` validates against the same `PERMISSION_CATALOG`) but are a property of the *key* presented, not of a signed-in user's roles — checked completely independently of `PermissionsGuard`.

`POST /v1/api-keys` (`api_keys:create`) generates the raw key (`esb_live_` + 32 random bytes, base64url), returns it **exactly once**, and persists only its hash — there is no "view the key again" API, by design. `DELETE /v1/api-keys/:id` (`api_keys:revoke`) marks it `REVOKED`; `ApiKeyValidatorService` treats a revoked or expired key identically to an unrecognized one.

## Feature Flags Integration

`FeatureFlagGuard` + `@RequireFeatureFlag(key)` wraps `@ecoswift/config`'s existing `FeatureFlagService.isEnabled()` (Phase 2C — deterministic rollout-percentage bucketing, scope matching) at the HTTP layer: a disabled flag short-circuits the request as `404`, before the handler runs — a flagged-off feature reads to the caller as "doesn't exist yet," not "you're blocked from it." `FeatureFlagAdminService` (`services/auth-service`) is the write side that package was never given: `GET/POST/PATCH /v1/feature-flags`, `POST /v1/feature-flags/:id/toggle`, all cache-invalidating (`FeatureFlagService.invalidate()`, added this phase, mirroring `ConfigurationService.invalidate()`) so a toggle takes effect immediately rather than after the 30s TTL.

## API Authorization at a glance

Full endpoint list (roles, permissions, API keys, feature flags, introspection) is in `rbac.md` § Role Management APIs — not duplicated here to avoid the two documents drifting apart. Every response follows the same standard envelope and error format `authentication.md`/Phase 3A already established (`HttpExceptionFilter`, `{ success, error: { code, message, details } }` on failure), validated via the same global `ValidationPipe`, documented in the same `/docs` Swagger UI (tag: `authorization`).

## Testing

- **Unit** (`packages/authz/src/**/*.spec.ts`, 51 tests): permission-catalog consistency (no duplicate codes, no unknown resources, no hierarchy cycles, least-privilege assertions per role), `PolicyEngineService` (AND/OR semantics, default-deny-on-failure), `PermissionResolverService` (hierarchy expansion, multi-role union, cycle-depth bound), and all four guards (`PermissionsGuard`, `OwnershipGuard`, `ApiKeyGuard`, `FeatureFlagGuard`) — every guard's negative path (missing user, missing header, denied permission/scope/flag) is explicitly covered, not just the happy path.
- **Unit** (`services/auth-service/src/modules/authorization/**/*.spec.ts`, 30 tests): `RoleService` (duplicate names, hierarchy cycle rejection, system-role delete protection, in-use delete protection), `UserRoleService` (duplicate assignment rejection, sensitive-role routing to approval, cache invalidation), `RoleAssignmentApprovalService` (the maker-checker rule itself — a requester can never approve or reject their own request, tested explicitly for both outcomes).
- **e2e** (`services/auth-service/test/authorization-flow.e2e-spec.ts`, real Postgres + Redis): default-deny for a zero-permission user, Super Administrator's effective set covering the whole catalog via hierarchy expansion, immediate non-sensitive assignment with real-time cache invalidation (no re-login needed), sensitive-role routing to approval, the requester being structurally forbidden from approving their own request, a different reviewer's approval actually granting the role, and the audit hash chain's global integrity (see `compliance-controls.md`).
- Every scenario above was also run manually against a live-booted instance before being captured as an automated test (the same "prove it live, then encode it as a regression test" pattern `authentication.md` used in Phase 3A) — including discovering and fixing two real bugs in the process: `AuthorizationModule` initially failed to boot because it needed `ConfigurationModule` imported directly (the same class of DI-composition bug Phase 3A's `ConfigurationModule` fix addressed for `AuthModule`), and the `feature-flags` toggle endpoint returned `201` instead of `200` before a `@HttpCode(HttpStatus.OK)` fix.

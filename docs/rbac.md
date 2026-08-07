# Ecoswift Bank — Role-Based Access Control

**Phase 3B deliverable.** The role model: the canonical 10-role catalog, role hierarchy, permission groups, role assignment, and delegated administration. Implements `security-model.md` § Step 7's RBAC intent with a real, evolved role catalog — see § Relationship to Phase 2A below for how the two lists differ and why.

See [`permission-matrix.md`](permission-matrix.md) for the full, generated permission-by-role grid, and [`authorization.md`](authorization.md) for how roles/permissions are actually enforced at request time.

---

## The role catalog

Ten roles (`packages/authz/src/catalog/permission-catalog.ts`'s `ROLE_CATALOG`, seeded via `prisma/seed.ts`):

| Role | Purpose | Sensitive? |
|---|---|---|
| `CUSTOMER` | Self-service only — own data, scoped by ownership checks, not a narrower permission set | No |
| `CUSTOMER_SUPPORT` | Front-line support: customer data, tickets, limited account actions | No |
| `OPERATIONS_OFFICER` | Day-to-day account/transaction/savings processing | No |
| `COMPLIANCE_OFFICER` | KYC decisions, compliance holds, regulatory export | No |
| `RISK_OFFICER` | Transaction risk review, fraud-hold decisions | No |
| `LOAN_OFFICER` | Loan application review, approval, disbursement | No |
| `FINANCE_OFFICER` | Financial operations and reporting oversight | No |
| `AUDITOR` | Read-only everywhere it has access at all — never a write role | No |
| `SYSTEM_ADMINISTRATOR` | Technical administration: users, roles, config, API keys, feature flags, webhooks | **Yes** |
| `SUPER_ADMINISTRATOR` | Full system authority, including actions that affect Administrators themselves | **Yes** |

Every role is seeded with `isSystemRole: true`, which only means one thing operationally: it can't be deleted via `DELETE /v1/roles/:id` (`RoleService.delete()` rejects it outright). It says nothing about whether the role's *permissions* can change — an operator can still grant/revoke individual permissions on a system role through the same API as a custom one.

### Relationship to Phase 2A/2B

`security-model.md` (Phase 2A) sketched an 8-role catalog (Customer, Support Agent, Compliance Officer, Operations, Auditor, Manager, Administrator, Super Administrator) at the architecture level; Phase 2B seeded a 7-role placeholder from that list (`SUPPORT_AGENT`, `COMPLIANCE_OFFICER`, `OPERATIONS`, `AUDITOR`, `MANAGER`, `ADMINISTRATOR`, `SUPER_ADMINISTRATOR`) with a representative, non-exhaustive permission set — nothing implemented it. Phase 3B is that implementation, against the Phase 3B brief's own (evolved) 10-role list: `Support Agent` → `Customer Support`, `Operations` → `Operations Officer`, `Administrator` → `System Administrator`, `Manager` dropped in favor of the more specific `Risk Officer`/`Loan Officer`/`Finance Officer`, and `Customer` promoted from "intentionally not a Role row" to a real, seeded `Role`. `prisma/seed.ts` migrates in place: it deletes the four superseded placeholder names (cascading away their `RolePermission`/`UserRole` rows — safe, since nothing had ever been assigned to them besides the seeded break-glass account's unchanged `SUPER_ADMINISTRATOR` role) and re-seeds against the real catalog, including pruning any `Permission` row whose `resource:action` pair doesn't exist in the current catalog at all, so a role whose *name* didn't change (`COMPLIANCE_OFFICER`, `AUDITOR`, `SUPER_ADMINISTRATOR`) doesn't end up with stale grants sitting alongside its current ones.

---

## Permission Groups

Not a separate table. Every `Permission` row's `resource` field (`accounts`, `customers`, `transactions`, ... — 17 in total, `PERMISSION_RESOURCES`) already *is* its group key — adding a redundant `PermissionGroup` join table to express something the data already expresses would be duplication, not a new capability. `PermissionService.groups()` (`GET /v1/permissions/groups`) is what turns that implicit grouping into the grouped API response a client actually wants: permissions bucketed by resource, 17 groups, ready to render as a form (e.g. an admin UI's "grant permissions" screen naturally sectioned by resource).

## Role Hierarchy

`Role.parentRoleId` (nullable, self-referencing FK) — a role inherits every permission its parent grants, in addition to its own direct grants, recursively up the chain. `PermissionResolverService.expandHierarchy()` (`@ecoswift/authz`) walks it: collect the role's own id, follow `parentRoleId` up to `AUTH_DEFAULTS`-style bound (`MAX_HIERARCHY_DEPTH = 10`, defense-in-depth against a misconfigured or — structurally impossible via `RoleService`'s cycle check, but never trust that alone — cyclic chain), union every `RolePermission` grant across the whole collected set.

Only one edge exists in the seeded catalog: `SUPER_ADMINISTRATOR.parentRoleId → SYSTEM_ADMINISTRATOR`. The other eight roles are lateral specialist roles with no parent — a real bank's compliance/risk/loan/finance functions aren't naturally a strict seniority ladder the way admin roles are, and forcing one wouldn't reflect anything true about how the roles actually relate. Super Administrator is *also* granted every permission directly (not relying on hierarchy expansion alone) — its full-authority intent should be visible on the role's own grant list, not just inferred from a parent link — but the hierarchy mechanism itself is real and exercised (`permission-catalog.spec.ts` and `permission-resolver.service.spec.ts` both test arbitrary-depth chains, not just the 2-level case the seed data happens to use).

`RoleService.update()` rejects any re-parenting that would introduce a cycle (`assertNoCycle`, walks the candidate parent's own ancestry looking for the role being updated) and rejects a role being set as its own parent outright — both checked *before* the write, not detected after the fact.

## Role Assignment

`POST /v1/user-roles` (`UserRoleService.assign`, requires `roles:assign`). What happens next depends on `Role.isSensitive`:

- **Non-sensitive role** → applied immediately: a `UserRole` row is created, the target user's cached effective-permission set is invalidated (so it's correct on their very next request, not after a TTL), `ROLE_ASSIGNED_TO_USER` is published.
- **Sensitive role** (`SYSTEM_ADMINISTRATOR`, `SUPER_ADMINISTRATOR` in the seeded catalog) → **never** applied immediately, no matter who's asking. A `RoleAssignmentApproval` row is created instead (`status: PENDING`), `ROLE_ASSIGNMENT_REQUESTED` is published, and nothing about the user's actual permissions changes until a *different* holder of `roles:assign` approves it — see [`compliance-controls.md`](compliance-controls.md) § Administrative Approval Hooks for the maker-checker mechanics.

`DELETE /v1/user-roles/:userId/:roleId` (`roles:revoke`) is a hard delete of the `UserRole` row — there's no "pending revocation" state, revocation isn't the sensitive direction (removing access is never the side of an action that benefits from being slow).

## Delegated Administration

Anyone holding `roles:assign` — which the seeded catalog grants to `SYSTEM_ADMINISTRATOR` and `SUPER_ADMINISTRATOR` — can assign any **non-sensitive** role immediately, without needing Super Administrator involvement. This is the actual mechanism behind "delegated administration": day-to-day role assignment (giving someone `CUSTOMER_SUPPORT`, `LOAN_OFFICER`, etc.) doesn't need to escalate to the smallest, most privileged group. What's *not* delegated is assigning further administrative authority itself — a System Administrator can hand out every operational role in the catalog on their own judgment, but granting `SYSTEM_ADMINISTRATOR` or `SUPER_ADMINISTRATOR` always requires the second approver `compliance-controls.md` describes, even when the requester already holds Super Administrator themselves.

## Role Management APIs

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/v1/roles` | `roles:read` | List all roles |
| GET | `/v1/roles/:id` | `roles:read` | Role detail + its direct permissions |
| GET | `/v1/roles/:id/audit-history` | `roles:read`, `audit_logs:read` | Role Audit History — every recorded change |
| POST | `/v1/roles` | `roles:create` | Create a custom role |
| PATCH | `/v1/roles/:id` | `roles:update` | Update description, hierarchy parent, or sensitivity (`name` is immutable — see `RoleService`'s own note on why) |
| DELETE | `/v1/roles/:id` | `roles:delete` | Delete a non-system role with no active assignments and no child roles |
| POST | `/v1/roles/:id/permissions` | `roles:update` | Grant a permission to a role |
| DELETE | `/v1/roles/:id/permissions/:resource/:action` | `roles:update` | Revoke a permission from a role |
| GET | `/v1/permissions` | `roles:read` | The full permission catalog |
| GET | `/v1/permissions/groups` | `roles:read` | Catalog grouped by resource |
| GET | `/v1/user-roles/:userId` | `roles:read` | Permission Inspection (of another user) — their held roles + effective permission set |
| POST | `/v1/user-roles` | `roles:assign` | Assign a role — see § Role Assignment above |
| DELETE | `/v1/user-roles/:userId/:roleId` | `roles:revoke` | Revoke a role |
| GET | `/v1/authorization/me/permissions` | *(self, no permission required)* | The caller's own effective permission set |
| POST | `/v1/authorization/check` | *(self, no permission required)* | Permission Inspection (of the caller) — does the caller hold every listed permission |

Every one of these endpoints is itself gated by `PermissionsGuard`/`@RequirePermissions()` — the authorization system enforces its own authorization, not a special-cased exemption.

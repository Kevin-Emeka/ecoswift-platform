# Ecoswift Bank — Compliance Controls

**Phase 3B deliverable.** How authorization integrates with audit logging, sensitive-action logging, and administrative approval — the compliance-facing half of Phase 3B, as distinct from [`authorization.md`](authorization.md)'s enforcement mechanics and [`rbac.md`](rbac.md)'s role model. Realizes `security-model.md` § Audit Strategy's intent for the first time with actual code, for the actions this phase controls (roles, permissions, role assignment, API keys, feature flags).

---

## Audit Logging

Every authorization mutation — role create/update/delete, permission grant/revoke, role assignment/revocation, approval decisions, API key create/revoke, feature flag create/update/toggle — writes an `AuditLog` row via `AuthorizationAuditService.record()` (`services/auth-service/src/modules/authorization/services/authorization-audit.service.ts`). This is the first phase to actually write to `AuditLog` — the table and its append-only guarantee were established in Phase 2B, unused until now.

### Hash chaining

Each `AuditLog` row's `integrityHash` is a SHA-256 over the row's own content **plus** the previous row's `integrityHash` (`previousHash`). Tampering with — or deleting — any row breaks the chain from that point forward for anyone who recomputes it, which is the actual tamper-evidence property `security-model.md` describes:

```
integrityHash = sha256({ actorUserId, actionType, resourceType, resourceId, beforeState, afterState, previousHash, createdAt })
```

**The chain is global, not per-resource-type.** Every action across every resource — a role update, an API key creation, a feature flag toggle — lands in the same sequence, ordered by `createdAt`. This matters for anyone verifying the chain: filtering to one `resourceType` before checking `previousHash === priorRow.integrityHash` will spuriously fail, because other actions interleave between same-resource-type rows in the real sequence (`authorization-flow.e2e-spec.ts`'s integrity test verifies the *unfiltered* sequence for exactly this reason — an earlier draft of that test filtered first and had to be corrected once real interleaved activity broke the false assumption).

**Enforcement is a real, live Postgres trigger** (`trg_audit_logs_immutable`, confirmed present via `pg_trigger` during Phase 3B's live verification) — it rejects any `UPDATE` or `DELETE` against `audit_logs` outright, not just an application-level convention. This was discovered to have a real, notable interaction: `AuditLog.actorUserId`'s foreign key is `onDelete: SetNull`, which means hard-deleting a `User` who has ever performed an audited action requires Postgres to `UPDATE audit_logs SET actor_user_id = NULL ...` as part of the cascade — and the trigger blocks that too. **A user who has ever performed an audited authorization action cannot be hard-deleted**, only soft-deactivated (`User.status = DEACTIVATED`, `deletedAt` set) — which is, in fact, already the only deactivation path `authentication.md`'s `AuthService.deactivateAccount()` exposes. This is a good property, not a bug: audit trail integrity is strong enough to resist being routed around via cascading deletes, and it was confirmed by hitting it directly during this phase's own test cleanup (see `authorization-flow.e2e-spec.ts`'s `afterAll`).

### Known limitation — concurrent writes

`AuthorizationAuditService.record()` reads the latest row, computes a hash against it, then inserts — at the application layer, not inside a single serialized database operation. Under true concurrent writes from multiple `auth-service` instances, two inserts could both read the same "latest" row and each compute a hash against it, forking the chain rather than extending it linearly. This is a known, documented gap, not a solved one — a production hardening pass would move chain computation into a database trigger or a serialized sequence rather than trusting single-process ordering. Named here rather than silently shipped, matching `authentication.md`'s pattern for `security-overview.md`'s own "what this phase did not build" section.

## Security Events

**Not wired by this phase.** `SecurityEvent` (Phase 2B schema, `SecurityEventType` enum: `LOGIN_SUCCESS`, `SUSPICIOUS_LOGIN`, `SESSION_REVOKED`, etc.) exists and is untouched by both Phase 3A and Phase 3B — Phase 3A recorded login/session activity through `LoginHistory` and domain events instead, and Phase 3B's authorization actions record through `AuditLog`. A future phase wiring risk-scoring or anomaly detection (`security-model.md`'s `LoginRiskEvaluationService`) is the natural place to start populating `SecurityEvent` — named as a gap here so it isn't mistaken for something this phase silently forgot rather than genuinely out of scope for it.

## Compliance Reporting

What's queryable today, without any new reporting infrastructure:

- `GET /v1/roles/:id/audit-history` — every recorded action against a specific role (Role Audit History, Phase 3B brief § Administration), ordered newest-first.
- Direct `AuditLog` queries (staff tooling, a future `audit-service` ingestion pipeline, or `reports:generate`/`reports:export`-permissioned code in a later phase) by `actorUserId`, `resourceType` + `resourceId`, or `createdAt` range — every index `AuditLog` was seeded with in Phase 2B (`@@index([actorUserId])`, `@@index([resourceType, resourceId])`, `@@index([createdAt])`) is exercised by this phase's writes for the first time.
- `beforeState`/`afterState` on every row capture exactly what changed (e.g. a permission grant/revoke records the specific `resource:action` code; a role update records the old and new `parentRoleId`) — a compliance reviewer doesn't need to infer intent from `description` text alone.

Building an actual `audit-service` ingestion pipeline or scheduled compliance export job is out of scope for this phase (`audit-service` itself is Phase 1 scaffold with no business logic in any phase so far) — this phase's job was making sure the *data* being produced is complete and trustworthy enough for that future consumer, not building the consumer.

## Sensitive Action Logging

Every mutation in the authorization module logs, without exception — there is no "log the important ones" filter. `AuthorizationAuditService.record()` is called from every write path in `RoleService`, `UserRoleService`, `RoleAssignmentApprovalService`, `ApiKeyService`, and `FeatureFlagAdminService` — verified by code review, not by a runtime assertion, since a missing audit call is a code-review-time concern (nothing about the type system can catch "this write forgot to also audit-log"). `actionType` uses `AuditLog`'s existing `AuditActionType` enum (`CREATE`/`UPDATE`/`DELETE`/`APPROVE`/`REJECT`) — no new enum values were needed; `resourceType` is a free-text discriminator (`'ROLE'`, `'USER_ROLE'`, `'ROLE_ASSIGNMENT_APPROVAL'`, `'API_KEY'`, `'FEATURE_FLAG'`) that both the audit-history query above and any future generic audit browser can filter on.

Domain events (`authorization.events.ts` — `ROLE_CREATED`, `ROLE_ASSIGNED_TO_USER`, `API_KEY_CREATED`, `FEATURE_FLAG_TOGGLED`, etc., 14 event types in total) are published **in addition to**, never instead of, the audit log write for the same action — the audit log is the durable, queryable, tamper-evident record; the event is the notification a downstream consumer (a future audit-ingestion service, a SIEM integration, a compliance dashboard) reacts to in real time. Losing an event to a consumer outage doesn't lose the fact — it's still sitting in `AuditLog`.

## Administrative Approval Hooks

Maker-checker for sensitive role assignment (`RoleAssignmentApprovalService`) — see `rbac.md` § Role Assignment for when this triggers (`Role.isSensitive = true`, seeded for `SYSTEM_ADMINISTRATOR` and `SUPER_ADMINISTRATOR`).

### What's structurally enforced, not just permission-gated

**The reviewer can never be the requester.** `assertMakerNotChecker()` compares `RoleAssignmentApproval.requestedBy` against the acting user id on every `approve()`/`reject()` call and throws `ForbiddenException` on a match — regardless of what permissions the requester holds, including Super Administrator approving their own request. This was verified live (a Super Administrator's own approval attempt on their own request correctly returned `403`) before being captured as `role-assignment-approval.service.spec.ts`'s and `authorization-flow.e2e-spec.ts`'s tests.

### Lifecycle

1. `POST /v1/user-roles` for a sensitive role creates `RoleAssignmentApproval(status: PENDING)` — the `UserRole` row does **not** exist yet, so nothing about the target user's actual access has changed.
2. `GET /v1/role-assignment-approvals` (`roles:assign`) — the queue of everything pending.
3. `POST /v1/role-assignment-approvals/:id/approve` (`roles:assign`, different actor) — creates the `UserRole` and marks the approval `APPROVED` in a single `$transaction`, then immediately invalidates the target user's cached permission set (no re-login needed for the grant to take effect — verified live and in `authorization-flow.e2e-spec.ts`).
4. `POST /v1/role-assignment-approvals/:id/reject` (`roles:assign`, different actor, optional `reviewNote`) — marks the approval `REJECTED`; no `UserRole` is ever created for a rejected request.
5. An already-decided approval (`APPROVED`/`REJECTED`) cannot be re-reviewed — `getPendingOrThrow()` rejects with `400` on anything not currently `PENDING`.

### What this does *not* cover

Deliberately scoped to **role assignment** only, not every sensitive authorization action:

- Granting/revoking an individual *permission* on a sensitive role (`POST/DELETE /v1/roles/:id/permissions/...`) is **not** maker-checker gated — only `roles:update` is required. A Super Administrator can unilaterally change what `SYSTEM_ADMINISTRATOR` grants; only *assigning that role to a specific person* requires a second approver. This is a deliberate scope boundary for this phase (the brief's "Administrative Approval Hooks" example case is role assignment specifically), named here so it isn't mistaken for an oversight — a natural Phase 3C+ extension would be a more generic `ApprovalPolicy` covering arbitrary sensitive actions, not just this one.
- Creating a **new** role with `isSensitive: true` doesn't itself require approval — only *assigning* that role to someone does. A malicious or careless `roles:create` holder could mark a role sensitive or not at creation time; the approval gate is on the assignment step, which is the point where real access actually changes hands.

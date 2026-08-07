# Ecoswift Bank — Security Model

**Phase 2A deliverable.** Role-based access control and the security model — authentication, authorization, session/credential/OTP/2FA lifecycles, risk and fraud detection hooks, audit strategy, encryption boundaries, and secrets management. Architecture only: no auth code, no middleware implementation beyond what Phase 1 already scaffolded for reference.

Where this document references something already built, it names the file so Phase 3 implementers know it's a foundation to extend, not a green field: `apps/*/src/middleware/correlation-id.middleware.ts`, `apps/*/src/filters/http-exception.filter.ts`, `packages/config/src/env.schema.ts` (`JWT_SECRET`, `JWT_REFRESH_SECRET`), and the `helmet()` + `ThrottlerModule` wiring in every `main.ts`/`app.module.ts`.

---

## Step 7 — Permissions Model (RBAC)

### Roles

| Role | Description |
|---|---|
| **Customer** | Self-service only — never sees another customer's data. |
| **Support Agent** | Front-line customer support: view customer data, manage tickets, limited account actions. |
| **Compliance Officer** | KYC decisions, sanctions review, compliance-hold freezes, regulatory export. |
| **Operations** | Day-to-day banking operations: loan/transaction processing, standard account actions. |
| **Auditor** | Read-only access to audit records, ledger detail, and regulatory reports. Never a write role. |
| **Manager** | Supervisory approvals (checker in maker-checker flows), limit overrides, escalation handling. |
| **Administrator** | Staff/role management, system configuration, elevated operational override. |
| **Super Administrator** | Full system authority, including actions that affect Administrators themselves. Smallest possible group. |

**M-C** in the tables below means the capability is only exercised as part of a **maker-checker** pair (`MakerCheckerPolicy` — see `domain-architecture.md` § Administration): one role/person initiates, a *different* role/person approves. No role can maker-and-checker its own action.

### Customer self-service capabilities

Scoped strictly to the customer's own data — there is no "view own data" vs "view any data" ambiguity below, all rows are own-data-only.

| Capability | Customer |
|---|---|
| View own profile, accounts, transactions, statements | ✅ |
| Update own profile / contact details | ✅ |
| Initiate own transfer | ✅ |
| Apply for loan / create savings plan | ✅ |
| Manage own security settings (password, 2FA, devices) | ✅ |
| Create / view own support tickets | ✅ |
| Freeze own account (self-request) | ✅ |
| View/approve KYC decisions | ❌ (submits documents only, decision is staff-only) |

### Staff capability matrix

| Capability | Support Agent | Compliance Officer | Operations | Auditor | Manager | Administrator | Super Admin |
|---|---|---|---|---|---|---|---|
| View any customer profile (read) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit customer profile on customer's behalf | ✅ (limited fields) | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Approve / reject KYC case | ❌ | ✅ | ❌ | ❌ | ✅ (high-risk secondary) | ✅ | ✅ |
| View KYC documents & sanctions results | ❌ | ✅ | ❌ | ✅ (read-only) | ✅ | ✅ | ✅ |
| Freeze account — customer-requested / suspected fraud | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Freeze account — compliance hold / court order | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Unfreeze account | ❌ | ✅ (compliance holds only) | ✅ (other categories) | ❌ | ✅ | ✅ | ✅ |
| Close account | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Approve loan (standard) | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Approve loan (above threshold) | ❌ | ❌ | M-C (maker) | ❌ | M-C (checker) | ✅ | ✅ |
| Override transaction / daily limit | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| View ledger / transaction detail (any customer) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Post manual ledger correction / reversal | ❌ | ❌ | M-C (maker) | ❌ | M-C (checker) | ✅ | ✅ |
| Manage support tickets (assign, resolve) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Escalate ticket | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| View audit records | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Export regulatory report | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Manage staff accounts / assign roles | ❌ | ❌ | ❌ | ❌ | ❌ | M-C (maker) | M-C (checker) |
| Approve sensitive admin action (generic checker) | ❌ | ❌ | ❌ | ❌ | ✅ (tier 1) | ✅ (tier 1–2) | ✅ (all tiers) |
| Manage system configuration / feature flags | ❌ | ❌ | ❌ | ❌ | ❌ | M-C (maker) | M-C (checker) |
| Modify an Administrator's own role/permissions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Design notes

- **No role can approve its own maker action.** This is enforced structurally (`SegregationOfDutiesPolicy`), not just by convention — the checker identity must differ from the maker identity or the approval is rejected outright.
- **Auditor is deliberately read-only everywhere.** An Auditor who could also write would compromise the independence the role exists for.
- **Administrator managing another Administrator, or Super Administrator authority itself, requires Super Administrator** — this prevents privilege self-escalation among admin staff.
- Every permission check is additionally scoped by **resource ownership/context** where applicable (e.g. "Support Agent can view any customer" is still logged with *which* customer per audit strategy below) — RBAC here answers "can this role do this kind of thing at all," not "should this specific access have happened," which is what audit review is for.

---

## Step 8 — Security Model

### Authentication flow

1. Client submits credentials to `POST /auth/login`.
2. Identity & Access verifies the `Credential` against the stored hash (never plaintext, never reversible — see Encryption Boundaries).
3. `LoginRiskEvaluationService` scores the attempt (device recognition, IP reputation, velocity, geography).
4. Low risk + recognized device → session issued directly.
5. Elevated risk or new device → step-up challenge (OTP or 2FA) required before a session is issued.
6. See [`workflows.md`](workflows.md) § Login for the full sequence including failure paths.

### Authorization flow

1. Every authenticated request carries the session's role/permission claims (resolved at session-issue time, not re-derived from the DB on every request — but invalidated immediately on `RoleAssigned`/`SessionRevoked`).
2. A guard layer checks: (a) is the session valid and unexpired, (b) does the role have the capability per the matrix above, (c) does the specific resource belong to/relate to the requester (for Customer role) or is cross-customer access being made by a staff role with a logged justification.
3. Denial is a generic `403 Forbidden` to the caller (no information leakage about *why*); the specific reason is recorded internally for audit.
4. This is standard RBAC with a resource-ownership check layered on top for the Customer role — full ABAC is not introduced in Phase 2A; it's flagged as a future consideration if permission needs grow more contextual than the matrix above can express.

### Session lifecycle

- **Issue**: on successful authentication (post step-up if required). Session carries a short-lived access token and a longer-lived refresh token (`JWT_SECRET` / `JWT_REFRESH_SECRET`, already present in `packages/config/src/env.schema.ts` from Phase 1).
- **Refresh**: refresh token exchanged for a new access token; refresh token itself rotates on use (no long-lived static refresh token in play at any point).
- **Expiry**: sliding inactivity timeout **and** absolute maximum lifetime, whichever is hit first (see `business-rules.md` § Session Policy).
- **Revoke**: explicit logout, password reset, or admin/compliance force-logout — takes effect immediately, checked on every request, not just on next refresh.

### Password lifecycle

- **Creation**: validated against `IsPasswordCompliantSpec` (Configuration-driven complexity rules).
- **Storage**: salted, adaptive one-way hash (e.g. bcrypt/argon2 class algorithm — specific choice is a Phase 2B/3 implementation detail); the plaintext never persists anywhere, including logs.
- **Rotation**: `PasswordRotationPolicy` blocks reuse of the last N passwords.
- **Reset**: possession-based only (email link or OTP); always invalidates all active sessions on completion.
- **Change**: self-service change also invalidates all *other* active sessions (the session used to make the change survives; every other device is logged out).

### OTP lifecycle

- **Generation**: short numeric code, cryptographically random, tied to a specific `OtpChallenge` with a purpose (login step-up, password reset, transaction confirmation).
- **Expiry**: short fixed window (minutes, not hours); a stale OTP is simply invalid, not just "less trusted."
- **Verification**: bounded number of attempts per challenge; exceeding it invalidates the challenge entirely (the customer must request a new OTP, not keep guessing against the same one).
- **Rate limiting**: OTP requests themselves are rate-limited per identity and per IP to prevent SMS/email bombing.

### 2FA lifecycle

- **Enrollment**: customer/staff opts in, method verified once at enrollment (e.g. confirm a TOTP code) before it's considered active.
- **Verification**: required at login when risk evaluation demands step-up, and optionally always-on per customer preference or per role (staff roles above Support Agent are recommended to require 2FA on every login, not just risk-triggered — a Phase 2B/3 policy decision, flagged here).
- **Recovery**: backup codes issued at enrollment, single-use, for the case a customer loses their 2FA device; regenerating backup codes invalidates the previous set.
- **Disable**: always triggers a security notification (`TwoFactorDisabled`); for staff roles above Support Agent, disabling 2FA is itself a maker-checker action, not self-service.

### Device trust

- A device is fingerprinted (not by invasive tracking, but by a stable client-generated identifier plus request characteristics) at first login.
- An untrusted device always triggers step-up on a sensitive action, regardless of overall session risk score.
- Trust is scoped to *device*, not *browser session* — clearing cookies doesn't re-trigger step-up if the underlying device identifier persists, but a genuinely new device always does.
- Customers can view and revoke trusted devices from their own security settings (self-service, no staff involvement needed).

### Risk detection

- Signals evaluated at login and at high-value actions (large transfer, new payee, profile change): device recognition, IP/geo reputation, velocity (too many actions too fast), impossible travel (login from a geographically implausible location given the last known one).
- Risk detection produces a score/signal, not an automatic block — it feeds `LoginRiskEvaluationService` (step-up decisions) and `FraudCheckService` (transaction holds), both of which apply policy on top of the raw signal.

### Fraud detection hooks

- `FraudCheckService` (in Payments & Transfers) is a **hook point**, not a full fraud engine in Phase 2A — it's the place a real-time scoring model or third-party fraud service plugs in later without changing the surrounding transfer validation flow (Open/Closed principle: the hook's interface is stable, its implementation can evolve).
- A transaction flagged by the fraud hook is held (not silently failed, not silently allowed) pending review — the customer sees a "pending" status, Operations/Compliance sees a review queue item.
- Every flag and its eventual resolution is an audited fact, feeding future model improvement even though model training itself is out of scope here.

### Audit strategy

- Every state-changing action across every context publishes an `AuditableEvent` (see `domain-architecture.md` § Context Map); Audit is a pure, trusted sink — see [`workflows.md`](workflows.md) § Audit Logging for the ingestion sequence.
- Audit records are **immutable and hash-chained**: each record includes a hash referencing the previous record, so any retroactive tampering breaks the chain and is detectable (`IntegrityVerificationService` / `IsChainIntactSpec`).
- Audit is **write-only from every context's perspective** — nothing outside Audit's own read API (`GET /audit/records`, permissioned per the RBAC matrix above) can query or modify audit data.
- Retention meets regulatory minimums per record category (`RetentionPolicy`); exact durations are a compliance/legal input for Phase 2B, not invented here.

### Encryption boundaries

- **In transit**: TLS everywhere, no exceptions — service-to-service traffic included, not just customer-facing edges.
- **At rest**: database-level encryption for the datastore as a baseline, **plus field-level encryption for the highest-sensitivity fields** (government ID numbers, full account numbers where displayed, KYC document contents) so a database-level compromise alone doesn't expose them in plaintext.
- **Passwords**: never encrypted (reversible) — always hashed (one-way), per Password Lifecycle above.
- **Application-layer secrets** (JWT signing keys, third-party API keys) are never stored alongside the data they protect — see Secrets Management.

### Secrets management

- No secret is ever committed to source control — Phase 1 already establishes this convention (`.env` is gitignored, `.env.example` ships only placeholders like `JWT_SECRET=changeme`).
- Production secrets are sourced from a dedicated secrets manager (e.g. AWS Secrets Manager/Parameter Store, HashiCorp Vault — concrete choice is a Phase 2B/3 infrastructure decision), injected at deploy/runtime, never baked into an image.
- Secrets are rotated on a schedule and immediately on suspected compromise; rotation must not require a code change (services read secrets by reference/name, not by value, at startup).
- Different secrets per environment (dev/staging/production) — a staging leak must never expose a production credential, which is also why `.env.example` in this repo only ever contains placeholders, never real staging values.

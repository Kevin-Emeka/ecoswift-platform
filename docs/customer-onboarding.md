# Ecoswift Bank — Customer Onboarding

**Phase 4A deliverable.** Customer profile completion, Terms & Conditions / Privacy Policy / Marketing consent, and customer status management — `services/account-service/src/modules/customers`. Builds on Phase 3A's Identity (`User`, `Profile`, `Customer` are already created at registration) rather than introducing a parallel "sign up" flow.

See [`account-opening.md`](account-opening.md) for what happens once onboarding is complete and a customer opens their first account, and [`account-numbering.md`](account-numbering.md) for account number generation.

---

## Where things live

`Customer` and a minimal `Profile` (name, date of birth, nationality) already exist the moment `POST /v1/auth/register` (auth-service, Phase 3A) succeeds — `Customer.status` starts `ACTIVE` and `Profile.profileCompletionStatus` starts `INCOMPLETE`. This phase's `account-service` **extends** that same `Profile`/`Customer` row with the banking-specific fields the brief asks for (address, occupation, preferred language/currency, timezone) rather than creating a second identity — `customers` (this service) and `auth`/`authorization`/`mfa` (auth-service) are two bounded contexts sharing one Postgres schema, communicating only through it and the event bus, never by importing each other's code.

## Customer Profile

`PATCH /v1/customers/me` — self-service, updates the caller's own `Profile` row:

| Field | Column | Notes |
|---|---|---|
| Address | `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `addressCountryCode` | Flat fields, not a second FK'd relation to `Country` (see the schema comment on `Profile` for why) — `addressCountryCode` is a plain ISO 3166-1 alpha-2 string, validated by `class-validator`'s `@Matches`, not a database join. |
| Occupation | `occupation` | Free text. |
| Preferred Language | `preferredLanguage` | ISO 639-1, defaults `"en"`. |
| Preferred Currency | `preferredCurrencyId` | Real FK to the seeded `Currency` catalog — rejected with 404 if it doesn't resolve to a known, active currency. |
| Timezone | `timezone` | IANA zone name, defaults `"UTC"`, validated as a non-empty string only (the full tz database is too large and changes too often to vendor a fixed enum here). |

## Profile Completion Status

`Profile.profileCompletionStatus` (`INCOMPLETE` \| `COMPLETE`) is computed, not client-settable — every response from `GET`/`PATCH /v1/customers/me` recomputes it from whichever of five fields are present: `addressLine1`, `city`, `addressCountryCode`, `occupation`, `preferredCurrencyId`. `preferredLanguage`/`timezone` are deliberately **excluded** from the completion check — both already default to a sensible value, so a customer who never touches them isn't blocked from "completing" their profile. The response also returns `missingFields: string[]` — the exact subset still outstanding — so a client can render a real checklist instead of a single boolean.

`CustomerProfileService.updateByUserId()` only issues a second `Profile` write when the computed status actually changes, rather than unconditionally re-persisting it on every update — a purely-additive PATCH (e.g. changing just `timezone`) that doesn't cross the completion threshold costs one write, not two.

## Onboarding Acceptance: Terms & Conditions, Privacy Policy, Marketing

`CustomerConsent` (new Phase 4A table) is an **append-only** log — `POST /v1/customers/me/consents` always inserts a new row, never updates one. This is a deliberate compliance decision, not an oversight: knowing a customer *currently* opted in to marketing communications isn't enough for a real bank; knowing *which version* of the Terms & Conditions or Privacy Policy they accepted and *when* is what a regulator or a dispute actually asks for. "Current status" for a given `consentType` is simply the most recent row (`GET /v1/customers/me/consents`, `ConsentService.currentStatuses()`).

Three types, one table, one endpoint shape:

| `consentType` | `version` | Meaning |
|---|---|---|
| `TERMS_AND_CONDITIONS` | The published document version (e.g. `"2026-01-01"`) | Mandatory. |
| `PRIVACY_POLICY` | Same | Mandatory. |
| `MARKETING_COMMUNICATIONS` | A constant (e.g. `"1.0"`) — there's no versioned document behind an opt-in/opt-out toggle | Optional, freely reversible. |

`accepted: false` is a **first-class value**, not an omission — withdrawing marketing consent, or (in principle) declining a re-published T&C, is recorded exactly the same way as accepting: a new row, `ipAddress` captured from the request, `acceptedAt` timestamped server-side.

`ConsentService.hasAcceptedMandatoryConsents(customerId)` resolves both `TERMS_AND_CONDITIONS` and `PRIVACY_POLICY` to their latest `accepted` value and requires both `true` — built as a reusable check for a future phase to gate account-opening or a banking action on (this phase does not itself enforce it anywhere; see "What this phase did not build" below).

## Customer Status Management

`CustomerStatus` (`ACTIVE` \| `INACTIVE` \| `DEACTIVATED`, Phase 2B schema) — `PATCH /v1/customers/:customerId/status`. Authorization here is ownership-based, not a single fixed permission:

- The caller may always change **their own** status (`customers:update`) — e.g. self-service deactivation.
- Changing **someone else's** status additionally requires `customers:delete` — the highest-trust permission in the `customers` resource, held only by staff roles in the catalog (`SUPER_ADMINISTRATOR`), reused here as the "may act on another customer's record" signal rather than inventing a new permission code for one action. The same convention appears in `account-opening.md`'s authorization table (`accounts:close` plays the identical role there).

Every status change is audited (`AuditLog`, `actionType: 'UPDATE'`, `resourceType: 'Customer'`) with before/after state and an optional `reason`.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/customers/me` | Bearer + `customers:read` | The caller's own profile, completion status, missing fields |
| PATCH | `/v1/customers/me` | Bearer + `customers:update` | Update address/occupation/language/currency/timezone |
| PATCH | `/v1/customers/:customerId/status` | Bearer + `customers:update` (+ `customers:delete` for another customer) | Customer status transition |
| GET | `/v1/customers/me/consents` | Bearer + `customers:read` | Current status per consent type |
| POST | `/v1/customers/me/consents` | Bearer + `customers:update` | Record acceptance/withdrawal |

## Authorization

`accounts:create` and `accounts:update` were added to the `CUSTOMER` role's permission grants this phase (`packages/authz/src/catalog/permission-catalog.ts`) — Phase 3B built the full RBAC catalog before this phase's self-service features existed to need them, and this is the additive completion of that catalog, not a redesign. `docs/permission-matrix.md` is regenerated from the catalog (`scripts/generate-permission-matrix.ts`, new this phase and now checked in — the original Phase 3B generation script was a one-off, not persisted) — always regenerate it after a catalog change rather than hand-editing.

## A real bug this phase's live testing caught

Booting `account-service` against a freshly-registered customer produced `403 Forbidden: Missing required permission(s): customers:read` on `GET /v1/customers/me` — a brand-new customer had **zero roles**, because `AuthService.register()` (Phase 3A) predates Phase 3B's RBAC system and never assigned the base `CUSTOMER` role. Every self-service endpoint in this phase (and every future self-service banking feature) depends on a customer holding it. Fixed in `auth-service`'s `register()`: the `CUSTOMER` role (`isSensitive: false`, so no maker-checker approval needed) is now assigned in the same transaction that creates the `User`/`Customer`/`Profile` rows, `assignedBy` set to the new user's own id. Regression-tested in `auth.service.spec.ts`.

## What this phase did not build

- **Enforcing mandatory-consent-before-account-opening** — `ConsentService.hasAcceptedMandatoryConsents()` exists and is unit-tested, but no endpoint in this phase calls it as a gate. `account-opening.md` explains this as a deliberate, named scope boundary, not an oversight.
- **KYC tier progression** — `Customer.tier` (`KycTier`) is unaffected by anything in this phase; profile completion and KYC verification are different concerns.
- **Consent document versioning/publishing workflow** (staff publishing a new T&C version, forcing re-acceptance) — this phase records acceptance of whatever `version` string a client sends; it does not maintain a catalog of "the current published version" for the client to check against.

## Testing

`customer-profile.service.spec.ts`, `consent.service.spec.ts` (unit, mocked Prisma) — completion-status computation for every missing-field combination, currency validation, append-only consent semantics (never an update), latest-row resolution per type, mandatory-consent gating logic. `test/account-opening.e2e-spec.ts` (e2e, real Postgres/Redis) covers the full profile-completion and consent-acceptance flow live, as part of the broader onboarding-through-account-opening journey.

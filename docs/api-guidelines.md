# Ecoswift Bank — API Guidelines

**Phase 2A deliverable.** REST conventions every context's public interface (`domain-architecture.md` § Public Interfaces) must follow. This formalizes patterns Phase 1 already established in code so Phase 3 implementation has one consistent standard to build every endpoint against, rather than each service inventing its own.

Where a convention is already implemented, the file is named so it's clear this is documentation of an existing decision, not a new one: `apps/*/src/main.ts` (versioning, `ValidationPipe`), `packages/types/src/http.ts` (`ApiResponse`, `ApiErrorResponse`, `PaginatedResult`), `packages/shared/src/dto/pagination.dto.ts` (`PaginationQueryDto`), `apps/*/src/filters/http-exception.filter.ts`.

---

## REST Conventions

- **Resource-oriented URIs**, plural nouns, no verbs: `/accounts`, `/accounts/{id}`, `/transfers`, not `/getAccount` or `/createTransfer`.
- **HTTP verbs carry meaning**: `GET` (read, no side effects), `POST` (create, or a non-idempotent action like `/transfers`), `PATCH` (partial update), `DELETE` (only where a resource is genuinely deletable — most banking resources are closed/deactivated, not deleted, per `business-rules.md`; `DELETE` is rare in this API by design).
- **Sub-resources for ownership**, not query params: `/accounts/{id}/transactions`, not `/transactions?accountId={id}`, when the relationship is a genuine containment (transactions belong to an account). Query params are for filtering within a collection, not for expressing ownership.
- **Actions that don't map cleanly to CRUD are modeled as a sub-resource verb-noun**, not a verb on the resource itself: `POST /accounts/{id}/freeze`, `POST /loans/applications/{id}/decision` — a small, deliberate exception to "no verbs," used only when the action is a genuine state transition, not a disguised update.
- **No breaking response shape changes without a version bump** — additive fields are fine within a version, anything else is a new version.

## Versioning

- **URI versioning**, already enabled in Phase 1 (`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` in every `main.ts`): `/v1/accounts`, `/v1/transfers`.
- A new major version is introduced only for breaking changes (removed/renamed fields, changed semantics of an existing field, changed status codes for existing scenarios).
- Multiple versions of a controller may run concurrently during a deprecation window; a deprecated version returns a `Deprecation`/`Sunset` response header (RFC 8594) once a replacement ships, giving consumers (including the Developer Portal-listed public API) advance notice before removal.

## Pagination

- Every collection endpoint is paginated by default — there is no unpaginated "return everything" mode for any resource that can grow unbounded (transactions, audit records, notifications).
- Request shape: `?page={n}&limit={n}`, matching the already-implemented `PaginationQueryDto` (`packages/shared/src/dto/pagination.dto.ts`) — `page` defaults to 1, `limit` defaults to 20, capped at 100 (`DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` in `packages/shared/src/constants`).
- Response shape: the already-defined `PaginatedResult<T>` (`packages/types/src/http.ts`) — `{ items, page, limit, total, totalPages }`, wrapped in the standard `ApiResponse` envelope (below).
- Offset-based pagination (page/limit) is the standard for staff-facing and low-volume customer collections. High-volume, append-only collections (ledger postings, audit records) should additionally support **cursor-based pagination** (`?cursor={opaque}`) for stable iteration under concurrent writes — offset pagination on a fast-growing collection can skip or duplicate rows across pages, cursor pagination can't. Both are documented here so Phase 2B's schema design accounts for cursor-friendly ordering (e.g. a monotonic sequence column) on those tables specifically.

## Filtering

- Filters are plain query params matching a resource's documented filterable fields: `GET /transfers?status=completed&accountId={id}`.
- Filtering is always **AND-combined** across distinct params; there is no OR-across-params syntax in v1 — a consumer needing OR semantics makes multiple requests. This keeps query semantics unambiguous and keeps the underlying query patterns predictable for indexing in Phase 2B.
- Date-range filters use explicit paired params, not a single operator syntax: `?createdAfter={ISO8601}&createdBefore={ISO8601}`.
- Every filterable field must be named explicitly in that endpoint's documentation — no implicit "any field can be a filter" behavior, since that both surprises consumers and makes indexing needs unpredictable.

## Sorting

- `?sort={field}` for ascending, `?sort=-{field}` for descending (leading `-` convention), single-field sort in v1: `?sort=-createdAt`.
- Each endpoint documents its allowed sort fields explicitly (same rationale as filtering — predictable index needs).
- Default sort order is always specified per endpoint (typically `-createdAt`, newest first) so pagination is stable even when a client doesn't specify `sort`.

## Response Format

Every successful response uses the standard envelope, already defined in `packages/types/src/http.ts`:

```jsonc
{
  "success": true,
  "data": { /* resource or PaginatedResult<T> */ },
  "meta": { /* optional: request-scoped extras, e.g. rate-limit info */ },
  "timestamp": "2026-07-30T12:00:00.000Z"
}
```

- `data` is always present on success; its shape is the resource (single) or a `PaginatedResult<T>` (collection) — never a bare array, so pagination metadata always has somewhere to live without a breaking shape change later.
- `meta` is optional and additive — consumers must not assume a fixed set of keys.

## Error Format

Every error response uses the standard envelope, already defined in `packages/types/src/http.ts` and produced by `HttpExceptionFilter` (`apps/*/src/filters/http-exception.filter.ts`):

```jsonc
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { /* optional, e.g. field-level validation errors */ }
  },
  "path": "/v1/transfers",
  "timestamp": "2026-07-30T12:00:00.000Z"
}
```

- `error.code` is a stable, machine-readable string (already modeled by `DomainException` subclasses in `packages/shared/src/exceptions/domain.exception.ts` — `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`) — consumers should branch on `code`, never on `message` (message text may change/be localized; code is a contract).
- HTTP status code and `error.code` are set together by the throwing `DomainException` (or mapped from `HttpException` for framework-level errors) — never inferred separately, avoiding the two drifting apart.
- 5xx responses never leak internal detail (stack traces, DB errors) in `error.message`/`details` — those are logged server-side (via the structured Pino logging already wired in `apps/*/src/logger/logger.module.ts`) and correlated to the response via `x-correlation-id`, not returned to the caller.

## Validation Strategy

- Every request body is a `class-validator`-decorated DTO, validated by Nest's global `ValidationPipe` — already configured in every `main.ts` with `whitelist: true, forbidNonWhitelisted: true, transform: true` (Phase 1). Concretely: unknown fields are stripped/rejected, not silently accepted; validated DTOs are transformed into typed instances, not left as raw `any`.
- Validation failure produces a single consistent shape: `error.code: "VALIDATION_ERROR"`, HTTP 422, with `error.details` listing each failing field — matching `ValidationException` in `packages/shared/src/exceptions/domain.exception.ts`.
- Validation is layered: DTO-level validation (shape/type/format — "is this a well-formed request") happens at the API boundary; domain-level validation (business rules — "is this well-formed request actually allowed," e.g. `IsWithinDailyLimitSpec`) happens in the domain layer and surfaces as a `DomainException`, not a DTO validation error. The two are never conflated — a request can be perfectly well-formed and still be rejected by business rules, and that's a `409`/`422` `DomainException`, not a `400` validation failure.
- Idempotency keys (`business-rules.md` § Transfer Validation) are validated as a required header/field on the specific mutating endpoints that need them, not globally — most `POST` endpoints don't need one (e.g. `POST /kyc/cases/{id}/documents` isn't dangerous to retry), only ones with real double-execution risk are.

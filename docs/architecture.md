# Architecture

This document explains the purpose and responsibility of every top-level folder in the Ecoswift Bank monorepo, and the architectural principles the codebase follows as it grows.

## Guiding Principles

- **Clean Architecture / DDD**: business logic is framework-agnostic where possible. Domain rules don't depend on Nest, Prisma, or HTTP — those are adapters around the domain, not the domain itself.
- **Bounded contexts as services**: each `services/*` app owns one banking capability end-to-end (its own modules, DTOs, and eventually its own database schema/tables namespaced within the shared Postgres instance). Cross-service communication happens over well-defined interfaces (HTTP/queue), never by importing another service's internals.
- **Shared code lives in `packages/`, once**: if two apps/services need the same type, utility, or UI primitive, it's extracted to a package rather than duplicated.
- **Dependency Injection everywhere**: Nest's DI container wires controllers → services → repositories. Nothing reaches for a global singleton or instantiates a dependency with `new` inside business logic.
- **Fail fast on config**: every app validates `process.env` against a Zod schema (`@ecoswift/config`) at bootstrap; a missing/invalid variable is a startup error, not a runtime surprise.

## `apps/`

Deployable, user- or client-facing entry points.

| App | Stack | Responsibility |
|---|---|---|
| `api` | NestJS | Core backend API gateway — the primary HTTP surface for web clients. Owns cross-cutting concerns (auth, rate limiting, request logging) that will front the domain services. |
| `admin` | Next.js | Internal-only dashboard for staff/operations to manage the platform. |
| `customer-portal` | Next.js | Public-facing web app customers use to interact with their accounts. |
| `mobile-api` | NestJS | Backend-for-frontend tailored to mobile client payload/latency needs, distinct from the general-purpose `api` gateway. |

Each Nest app follows the same internal layout (see below); each Next.js app follows the App Router convention.

### NestJS app layout (`apps/api`, `apps/mobile-api`, every `services/*`)

```
src/
├── modules/       # Feature modules (one per bounded context) — empty until Phase 2+
├── common/        # Cross-cutting decorators, interfaces, DTOs shared within the app
├── config/        # Env-driven configuration factory + validation
├── middleware/     # Request-level middleware (e.g. correlation id)
├── guards/         # Route guards (auth, roles) — introduced when auth ships
├── interceptors/    # Cross-cutting request/response transforms (e.g. logging)
├── filters/         # Global exception filters → consistent ApiErrorResponse shape
├── database/        # App-local re-export of the shared PrismaModule
├── health/           # Liveness/readiness endpoint (Terminus)
├── logger/           # Structured Pino logger module
├── app.module.ts
└── main.ts
```

### Next.js app layout (`apps/admin`, `apps/customer-portal`)

```
app/          # App Router routes, layouts, and a /api/health route handler
components/   # App-specific composite components (primitives come from @ecoswift/ui)
hooks/        # React hooks
lib/          # Client-side utilities (re-exports @ecoswift/ui's cn(), etc.)
services/     # Typed fetch wrappers for calling backend APIs
styles/       # Design-token overrides beyond app/globals.css
public/       # Static assets
```

## `services/`

Independently deployable NestJS microservices, one per banking domain capability:

- `auth-service` — authentication & identity (introduced in a later phase)
- `transaction-service` — money movement processing
- `account-service` — account lifecycle & balances
- `notification-service` — push/in-app notifications
- `receipt-service` — receipt/document generation
- `email-service` — transactional email delivery
- `sms-service` — SMS delivery
- `loan-service` — loan origination & servicing
- `savings-service` — savings products
- `reporting-service` — reporting & analytics
- `audit-service` — audit trail / compliance logging
- `kyc-service` — identity verification

Each currently ships the same foundation layout as `apps/api` (health check, logging, config, exception handling) with zero business logic — feature modules land module-by-module starting in Phase 2.

## `packages/`

Code shared across every app and service, published internally via pnpm workspace protocol (`workspace:*`).

| Package | Purpose |
|---|---|
| `@ecoswift/types` | Framework-agnostic shared TypeScript types (API envelopes, health status, pagination). |
| `@ecoswift/utils` | Generic utilities (Result type, retry/backoff, sleep) with no framework dependency. |
| `@ecoswift/shared` | Cross-cutting building blocks: base domain exceptions, common DTOs (pagination query), shared constants. |
| `@ecoswift/config` | Zod-based environment schema + validator consumed by every app's `config/validation.ts`, plus `branding.ts` (brand name, tagline, contact addresses, public portal URLs) and, since Phase 2C, `ConfigurationService`/`FeatureFlagService` — the database-backed, staff-editable runtime configuration store. |
| `@ecoswift/database` | Prisma client singleton wrapped as an injectable `PrismaService` + global `PrismaModule`, generated from the single root `prisma/schema.prisma`. |
| `@ecoswift/ui` | Shared React component library (Shadcn UI conventions) consumed by `admin` and `customer-portal`. |
| `@ecoswift/cache` | Redis client (single-node/Cluster), `CacheService` (cache-aside), `DistributedLockService`. *(Phase 2C)* |
| `@ecoswift/resilience` | Circuit breaker, retry-with-jitter, Redis-backed idempotency. *(Phase 2C)* |
| `@ecoswift/event-bus` | Domain event publisher/subscriber ports, the event catalog, Redis Streams transport. *(Phase 2C)* |
| `@ecoswift/queue` | Message queue abstraction (BullMQ), background worker framework, job scheduler, the 7 named queues. *(Phase 2C)* |
| `@ecoswift/storage` | S3-compatible object storage abstraction (real S3/MinIO in prod, filesystem in dev). *(Phase 2C)* |
| `@ecoswift/secrets` | Secrets manager abstraction (env in dev, AWS Secrets Manager in prod). *(Phase 2C)* |
| `@ecoswift/observability` | Health indicators, Prometheus metrics, OpenTelemetry tracing bootstrap, correlation/request ID middleware. *(Phase 2C)* |
| `@ecoswift/http` | Redis-backed distributed rate limiting, `AsyncLocalStorage`-based request context. *(Phase 2C)* |

Full detail on the Phase 2C packages: [`infrastructure.md`](infrastructure.md), [`events.md`](events.md), [`queues.md`](queues.md), [`observability.md`](observability.md).

## `infrastructure/`

Everything needed to run and operate the platform outside of application code.

- `docker/` — generic, parameterized multi-stage Dockerfiles (`Dockerfile.nestjs`, `Dockerfile.nextjs`) used by every app/service via `turbo prune`, so each image only ships the workspace subset it needs.
- `nginx/` — reverse proxy config routing `/api`, `/admin`, and `/` to the respective containers for local development.
- `monitoring/` — Prometheus scrape config skeleton (dashboards/alerts added later).
- `logging/` — documentation of the structured-logging approach and where log-shipping config will live once a real aggregator is provisioned.
- `scripts/` — infra-level shell scripts consumed by containers/CI (e.g. `wait-for-it.sh`).
- `terraform/` — infrastructure-as-code entry point (provider/backend skeleton only; no cloud resources defined yet).

## `prisma/`

A single `schema.prisma` at the repo root is the source of truth for the database schema, shared by every app/service through `@ecoswift/database`. Phase 1 defines only the `datasource`/`generator` blocks — no models yet, since no domain data has been designed.

## `docs/`

Engineering documentation, starting with this architecture doc. Future ADRs (architecture decision records) and per-domain design docs land here.

## `scripts/`

Local developer-experience scripts (`setup.sh` bootstraps `.env`, installs deps, generates the Prisma client). Distinct from `infrastructure/scripts/`, which holds scripts meant to run *inside* containers or CI.

## `.github/workflows/`

GitHub Actions CI: install → lint → typecheck → build → test, running on every push/PR to `main`/`develop`. Test jobs spin up ephemeral Postgres/Redis containers via GitHub Actions `services:`.

## `.vscode/`

Shared editor settings (format-on-save via Prettier, ESLint flat-config integration) and recommended extensions, so every contributor's local setup matches CI's expectations.

# Ecoswift Bank — Platform Infrastructure

**Phase 2C deliverable.** The enterprise infrastructure layer every banking service depends on: Redis (single-node and Cluster), the event bus, message queues and background workers, object storage, secrets management, centralized configuration, health/readiness/liveness, and the resilience primitives (circuit breaker, retry, idempotency, distributed locking). Built as 9 shared packages under `packages/`, each following the same Hexagonal (ports & adapters) shape established in [`domain-architecture.md`](domain-architecture.md) — application code depends on a port (an interface), never on a concrete SDK, so the underlying technology is swappable without touching business logic.

Everything here is real, working code — not a design document. `apps/api` is wired up as the reference integration; see § Reference Integration for exactly what that looks like and how it was verified live.

---

## Package Map

| Package | Provides | Concrete adapter(s) |
|---|---|---|
| `@ecoswift/cache` | `CacheModule`, `CacheService` (cache-aside), `DistributedLockService`, `REDIS_CLIENT` | `ioredis` (single-node `Redis` or `Redis.Cluster`, selected by config) |
| `@ecoswift/resilience` | `CircuitBreakerFactory`, `withRetryPolicy`/`@Retryable()`, `IdempotencyService` | `opossum` (circuit breaker); Redis-backed idempotency via `@ecoswift/cache` |
| `@ecoswift/event-bus` | `EVENT_PUBLISHER`/`EVENT_SUBSCRIBER` ports, the 17-event catalog, `EventBusModule` | `RedisStreamsEventBus` (consumer groups, DLQ) |
| `@ecoswift/queue` | `QueuePort`, `BaseWorker`, `JobSchedulerService`, the 7 named queues | `bullmq` |
| `@ecoswift/storage` | `OBJECT_STORAGE` port, `StorageModule` | `S3ObjectStorageAdapter` (S3-compatible), `LocalDiskObjectStorageAdapter` (dev) |
| `@ecoswift/secrets` | `SECRETS_MANAGER` port, `SecretsModule` | `EnvSecretsAdapter` (dev), `AwsSecretsManagerAdapter` (staging/prod) |
| `@ecoswift/config` (extended) | `ConfigurationService`, `FeatureFlagService`, `ConfigurationModule` | Postgres (`ApplicationSetting`/`FeatureFlag`, Phase 2B) + Redis cache |
| `@ecoswift/observability` | Health indicators, `MetricsModule`, `startTracing()`, correlation/request ID middleware | `@nestjs/terminus`, `prom-client`, OpenTelemetry SDK |
| `@ecoswift/http` | `RateLimitModule` (Redis-backed), `RequestContext` (`AsyncLocalStorage`) | `@nestjs/throttler` + `RedisThrottlerStorage` |

All 9 are real workspace packages (`packages/*`), each with a `build`/`lint`/`typecheck` script wired into the same Turborepo pipeline as every Phase 1 package.

## Composition Rule

Every `@Global()` infra module (`CacheModule`, `EventBusModule`, `QueueModule`, `StorageModule`, `SecretsModule`, `RateLimitModule`) is imported **once**, in the app's `AppModule`. Once imported, its exports (`REDIS_CLIENT`, `EVENT_PUBLISHER`, the named queue tokens, etc.) are available application-wide without re-importing — that's what `@Global()` means in Nest's DI system. `ResilienceModule` and `ConfigurationModule` are ordinary (non-global) modules that depend on those globals having already been registered.

**Import order matters** for one reason: `CacheModule` provides `REDIS_CLIENT`, which `ResilienceModule`, `EventBusModule`, `QueueModule`, `ConfigurationModule`, `RateLimitModule`, and `RedisHealthIndicator` all inject. `CacheModule.forRoot()` must be imported before (or alongside — Nest resolves the graph, but keeping it first in the array documents the dependency) any of those. See `apps/api/src/app.module.ts` for the reference order.

## Redis

### Single-node (default)

`REDIS_URL` (e.g. `redis://localhost:6379`, already provisioned in the root `docker-compose.yml` since Phase 1). `createRedisClient()` (`packages/cache/src/redis-client.factory.ts`) returns a plain `ioredis.Redis` instance when `REDIS_CLUSTER_ENABLED` is unset/`false`.

### Redis Cluster

Set `REDIS_CLUSTER_ENABLED=true` and `REDIS_CLUSTER_NODES=host1:6379,host2:6379,host3:6379` (comma-separated seed nodes — ioredis discovers the rest of the topology from the cluster's own `CLUSTER SLOTS` response). The same factory then returns an `ioredis.Cluster` instance with `scaleReads: 'slave'` (reads can be served by a replica; writes always go to the shard's master) and a bounded retry strategy.

**Local testing**: [`infrastructure/docker/redis-cluster/docker-compose.redis-cluster.yml`](../infrastructure/docker/redis-cluster/docker-compose.redis-cluster.yml) stands up a real 6-node cluster (3 masters + 3 replicas — the minimum topology that survives one node failure per shard without losing write availability) for validating cluster-mode code paths before they ever reach staging/production:

```bash
docker compose -f infrastructure/docker/redis-cluster/docker-compose.redis-cluster.yml up -d
# then point the app at it:
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=localhost:7001,localhost:7002,localhost:7003,localhost:7004,localhost:7005,localhost:7006
```

This is intentionally a separate compose file from the root `docker-compose.yml`'s single-node `redis` service — most local dev doesn't need cluster complexity, and running one is a deliberate, explicit choice.

### Cluster-mode gotchas already handled

- **`SCAN` is per-node in Cluster mode.** `CacheService.delByPrefix()` scans each master shard individually (`cluster.nodes('master')`) rather than assuming a single scannable keyspace — ioredis doesn't expose `scanStream()` on the `Cluster` object directly, and this was caught by real typechecking against ioredis's own types, not discovered later.
- **`DistributedLockService`** uses a single-key `SET NX PX` + compare-and-delete Lua release script — correct against one Redis primary or a Cluster (a single key always lives on one shard), but **not** the multi-primary Redlock algorithm. See the doc comment on `DistributedLockService` for why that distinction matters and when to actually reach for the `redlock` package instead (only if Ecoswift Bank ever runs multiple *independent* Redis primaries specifically for locking quorum — not the case for a single Cluster).
- **BullMQ's queue names must not contain `:`** — it's BullMQ's own internal Redis key delimiter. Caught during live boot testing (`Queue name cannot contain :`) when the first draft used `queue:email`-style names; fixed to `ecoswift-email` etc. (`packages/queue/src/queues/queue-names.ts`).

## Event Bus

Full design in [`events.md`](events.md) (this file's sibling — extended in this phase with the implementation-level detail; the business-level catalog from Phase 2A stays there too). Summary: `RedisStreamsEventBus` implements both `EventPublisherPort` and `EventSubscriberPort` over Redis Streams consumer groups — at-least-once delivery, per-event dead-letter streams after `maxAttempts`, delivery count tracked via `XPENDING`.

## Queues & Background Workers

Full design in [`queues.md`](queues.md). Summary: `BullMQQueueAdapter<TPayload>` implements `QueuePort<TPayload>` per named queue (Emails, SMS, Push, Receipts, Statements, Audit Logs, Reports — the 7 from the brief); `BaseWorker<TPayload>` is the abstract base every consumer extends; `JobSchedulerService` wraps BullMQ's `upsertJobScheduler` for cron-pattern recurring jobs (month-end interest posting, nightly report generation, etc. — registered against the exact same queues the on-demand producers use, not a parallel scheduling system).

## Object Storage

`ObjectStoragePort` (`put`/`get`/`delete`/`exists`/`getSignedUrl`). Two adapters, selected by `STORAGE_DRIVER`:

- **`local`** (dev default) — filesystem, under `STORAGE_LOCAL_PATH` (default `./.storage`, gitignored). `getSignedUrl` here is a plain `file://` path with no real access control — a dev convenience so code written against the port behaves identically locally, not a security boundary.
- **`s3`** — real AWS S3 *or* any S3-compatible server (MinIO, DigitalOcean Spaces, Cloudflare R2) via `@aws-sdk/client-s3`; `STORAGE_S3_ENDPOINT`/`STORAGE_S3_FORCE_PATH_STYLE` are the two knobs that differ between real S3 and a compatible server, everything else is identical.

Intended consumers (wired in later phases, not this one — Phase 2C is infrastructure, not the receipt/statement business logic itself): KYC document storage, generated receipts/statements.

## Secrets Management

`SecretsManagerPort` (`getSecret`/`refreshSecret`), selected by `SECRETS_DRIVER`:

- **`env`** (dev default) — reads `process.env`, i.e. `.env` (gitignored since Phase 1).
- **`aws`** — AWS Secrets Manager, with an in-process TTL cache (5 minutes default) so every use doesn't round-trip to AWS, while still picking up a rotated secret without requiring a restart.

Deliberately **not** built on `@ecoswift/cache`/Redis — a secret (e.g. the Redis password itself) may need resolving before Redis is even reachable, so this package's cache is in-process memory only, never a shared store. See `security-model.md` § Secrets Management for the policy this implements.

## Centralized Configuration & Feature Flags

`ConfigurationService` and `FeatureFlagService` (`packages/config`) read `ApplicationSetting`/`FeatureFlag` rows (Phase 2B's schema, seeded with real starter values in `prisma/seed.ts` — transfer limits, password policy, maker-checker thresholds), cached in Redis with a short TTL (60s / 30s) so a change made via the admin app propagates to every running instance without a restart or an event-bus round-trip. This is the realization of the "runtime, staff-editable configuration store" `domain-architecture.md` § Configuration described as a Phase 2B/3 capability.

**Feature flag rollout is deterministic**, not a coin flip per request: `(flagKey, subjectId)` hashes (SHA-256) to a stable bucket in `[0, 100)`, so a given customer sees the same on/off state on every request throughout a gradual rollout, rather than a flickering experience.

### Environment Hierarchy

Four environments, one canonical schema (`packages/config/src/env.schema.ts`, `NODE_ENV: development | test | staging | production`):

| Environment | Redis | Storage | Secrets | Tracing |
|---|---|---|---|---|
| Development | single-node, local `docker-compose.yml` | `local` (filesystem) | `env` (`.env`) | off (`OTEL_ENABLED=false`) |
| Testing (CI) | single-node, ephemeral container (already wired in `.github/workflows/ci.yml`, Phase 1) | `local` | `env` | off |
| Staging | Cluster (smaller topology) | `s3` (staging bucket) | `aws` | on, staging collector |
| Production | Cluster (full topology, § Redis Cluster) | `s3` (production bucket) | `aws` | on, production collector |

Every environment validates against the exact same Zod schema — there's no separate "staging schema"; only the *values* differ, enforced by `.env` (dev/test) vs. real secrets-manager-injected environment variables (staging/prod, per `security-model.md`'s secrets policy). This is deliberate: a config shape that only gets validated in production is a config shape whose bugs are only discovered in production.

## Health Checks, Readiness, Liveness

`apps/api/src/health/health.controller.ts` (the reference — same pattern applies to every other service) exposes three distinct endpoints, not one:

- **`GET /v1/health`** — full status, every dependency, for humans/dashboards.
- **`GET /v1/health/live`** — **liveness**: is the process itself responsive? No external dependency checks. A database outage must never cause an orchestrator to kill and restart a perfectly healthy pod — that's what *readiness* failing communicates instead.
- **`GET /v1/health/ready`** — **readiness**: can this instance serve traffic right now? Checks Postgres + Redis. Failing readiness means "stop routing traffic here," not "restart me."

`RedisHealthIndicator` (`packages/observability`) follows the exact class-based `HealthIndicator` pattern Phase 1 already established for `PrismaHealthIndicator` — same `HealthCheckService.check([...])` array, one more entry.

## Resilience

- **Circuit Breaker** (`CircuitBreakerFactory`, wrapping `opossum`): named, cached breakers — the same logical dependency (e.g. a future payment rail, an SMS provider) shares one breaker across every call site, so it actually protects the dependency as a whole rather than each call site tripping its own independent breaker.
- **Retry** (`withRetryPolicy` / `@Retryable()`): exponential backoff **with jitter** (±20%, avoids many callers retrying in lockstep after a shared outage) and a `shouldRetry` predicate (a validation error should never be retried; a transient network error should). Builds on `@ecoswift/utils`' dependency-free `retry()` from Phase 1 rather than replacing it — that one stays available for packages that can't take a dependency on `@ecoswift/resilience`.
- **Idempotency** (`IdempotencyService`, Redis-backed): the concrete implementation of the idempotency-key requirement `api-guidelines.md` and `business-rules.md` § Transfer Validation describe for endpoints like `POST /transfers`. Three outcomes for a given key: never seen (run and cache), already completed (replay the cached result), or currently in-flight (wait briefly for the concurrent request to finish, or throw `IdempotencyConflictError`).
- **Distributed Locking** (`DistributedLockService`, § Redis above).

## Correlation IDs, Request IDs, Request Context

- **`CorrelationIdMiddleware`**: propagates an existing `x-correlation-id` across a whole logical operation (client → gateway → service → event → worker), generating one only at the chain's true origin. Canonical shared version — Phase 1's per-app copies (`apps/*/src/middleware/correlation-id.middleware.ts`) are superseded by this package; `apps/api`'s copy has been removed in favor of it.
- **`RequestIdMiddleware`**: always freshly generated, identifies exactly one hop — distinct purpose from correlation id (one operation vs. one request).
- **`RequestContext`** (`@ecoswift/http`, `AsyncLocalStorage`-backed): makes correlation id, request id, and (once auth exists) the acting user available anywhere in a request's async call chain — a deeply nested domain service, a logger, an error handler — without threading them through every function signature.

## API Gateway Middleware & Rate Limiting

`RateLimitModule.forRoot()` is a drop-in replacement for the plain `ThrottlerModule.forRoot([...])` every Phase 1 app configured — same `@Throttle()`/`ThrottlerGuard` usage at the call site, but backed by `RedisThrottlerStorage` instead of the default in-memory store. This matters concretely at scale: with in-memory storage, "100 requests/minute" enforced across 3 running instances of `apps/api` behind a load balancer is actually a 300/minute limit in aggregate, silently, because each process counts independently. `RedisThrottlerStorage` makes the limit real regardless of instance count — verified live (see § Reference Integration) by inspecting the `throttle:*` keys it actually writes to Redis.

## Reference Integration

`apps/api` is the reference implementation — every package above is wired into its `AppModule`, and the integration was **verified live**, not just built:

1. Brought up Postgres + Redis (`docker compose up postgres redis`), applied the Phase 2B migration, confirmed seed data intact.
2. Booted `apps/api` against them (`node apps/api/dist/main.js`) — every module in the DI graph resolved (`CacheModule` → `ResilienceModule`/`EventBusModule`/`QueueModule`/`ConfigurationModule`/`RateLimitModule` → `HealthModule`, in that order, matching § Composition Rule).
3. `GET /v1/health` → `{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"},"memory_heap":{"status":"up"}}}`.
4. `GET /v1/health/live` → memory only (no Postgres/Redis check, confirming liveness is truly dependency-free).
5. `GET /v1/health/ready` → database + redis only (confirming readiness is scoped to what serving traffic actually needs).
6. `GET /v1/metrics` → real Prometheus-format output with an actual recorded `http_request_duration_seconds` observation for the preceding request.
7. Response headers on a plain request: `x-correlation-id`, `x-request-id`, and `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`X-RateLimit-Reset` all present.
8. `redis-cli KEYS "*"` on the running container showed real `bull:ecoswift-email:meta` (and the other 6 queues) and `throttle:default:*` keys — proof the queue and rate-limit infrastructure aren't just compiling, they're actually writing to Redis in the expected shape.

Three real bugs were caught and fixed during this live verification (not just at typecheck time) — see § Bugs Found During Integration.

Other services (`services/*`, `apps/mobile-api`) adopt these packages incrementally as their own business logic lands in Phase 3 — this phase establishes and proves the pattern in one place rather than mechanically repeating the same `AppModule` wiring across all 14 apps before there's any business logic to justify it there yet.

## Bugs Found During Integration

Caught by actually building, typechecking, and booting the stack — not just writing code and assuming it works:

1. **Monorepo `rootDir` violation.** The moment a `packages/*` package imported another package's source via `tsconfig.base.json`'s path mapping (new in this phase — no Phase 1/2A/2B package had done this), `tsc` failed: the mapped source file falls outside the importing package's declared `rootDir: "src"`. Fixed by overriding `"paths": {}` in each affected package's own `tsconfig.json`, forcing Node resolution through the dependency's built `dist/` (matching how `@nestjs/common` or any other npm dependency already resolves) instead of reaching into source.
2. **Build pollution from those same failed builds.** Because `tsconfig.base.json` doesn't set `noEmitOnError`, the failed `tsc -p tsconfig.json` runs above still emitted whatever output they'd computed — which, given the rootDir confusion, landed compiled `.js`/`.d.ts` files directly inside `packages/shared/src/`, alongside the real `.ts` source. Found via `find packages/*/src -name '*.js'` and removed; confirmed no other package was affected.
3. **`ioredis.Cluster` has no `scanStream()`.** (§ Redis above.)
4. **Zod's `.url().optional()` rejects empty string, not just `undefined`.** `.env`/`.env.example` document an unset optional var as `KEY=` (empty string), which `process.env` reports as `""` — and `"".url()` correctly fails as "not a URL." Every optional URL field needed an `optionalUrl()` helper that treats `""` as absent before validating. Caught at actual app boot (`Invalid environment configuration: STORAGE_S3_ENDPOINT: Invalid url`, etc.), not at typecheck — Zod's runtime validation isn't something `tsc` checks.
5. **`ThrottlerModule.forRootAsync`'s `inject` array can't see a sibling module's providers.** `RedisThrottlerStorage` needs to be provided by a module `ThrottlerModule.forRootAsync` itself imports (via the async options' own `imports` field), not just declared in `RateLimitModule`'s `providers` array next to it — Nest's DI graph doesn't share providers between sibling modules. Fixed with a small internal `RedisThrottlerStorageModule`.
6. **BullMQ rejects `:` in queue names.** (§ Redis above.)

Every one of these was reproduced, understood, and fixed against the live system — the boot log and curl output in § Reference Integration are the actual evidence, not a claim.

## What Phase 2C Deliberately Did Not Do

Per the brief's explicit boundary: no authentication. `RequestContext` has an `actorId`/`actorType` shape ready for when auth exists, but nothing in this phase populates it — that's Phase 3A's job. No business logic was added to any queue worker or event subscriber beyond the framework itself (`BaseWorker`, the event catalog types) — actual email/SMS sending, receipt generation, etc. are Phase 3+ concerns that will consume this infrastructure, not extend it.

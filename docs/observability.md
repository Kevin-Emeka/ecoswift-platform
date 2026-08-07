# Ecoswift Bank — Observability

**Phase 2C deliverable.** Health/readiness/liveness, metrics, distributed tracing, centralized structured logging, and correlation/request IDs — plus the integration points prepared for Prometheus, Grafana, OpenTelemetry collectors, and alerting. Implemented in [`packages/observability`](../packages/observability); see [`infrastructure.md`](infrastructure.md) for the surrounding platform context.

## Health, Readiness, Liveness

Three distinct endpoints per app (`apps/api/src/health/health.controller.ts` is the reference; the same three-endpoint shape applies to every other service), matching Kubernetes-style probe conventions — because "is it healthy" is actually three different questions with three different correct responses:

| Endpoint | Question | Checks | Failure means |
|---|---|---|---|
| `GET /v1/health` | Full status, for humans/dashboards | Database, Redis, memory heap | (informational — not wired to an orchestrator action) |
| `GET /v1/health/live` | Is the process itself still responsive? | Memory heap only — **no external dependencies** | "Restart me" |
| `GET /v1/health/ready` | Can this instance serve traffic right now? | Database, Redis | "Stop routing traffic here" |

The liveness/readiness split matters concretely: if liveness checked the database, a Postgres blip would cause an orchestrator to kill and restart every apps/api pod simultaneously — the opposite of what you want during a database incident, when you need the fleet to stay up and simply stop accepting new work until the dependency recovers. Readiness failing (pods drop out of the load balancer, keep running, resume serving once the check passes again) is the correct response to a downstream outage; liveness failing (kill and restart) is the correct response to the process itself being wedged.

`RedisHealthIndicator` (`packages/observability/src/health/redis.health.ts`) follows the exact class-based `HealthIndicator` pattern (`@nestjs/terminus`) Phase 1 already established for `PrismaHealthIndicator`/`MemoryHealthIndicator` — one more entry in the same `HealthCheckService.check([...])` array, not a parallel health-check mechanism.

**Verified live**: booted against real Postgres + Redis, `/v1/health` returned `{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"},"memory_heap":{"status":"up"}}}`; `/v1/health/live` returned memory only; `/v1/health/ready` returned database + redis only — confirming the three endpoints actually check what they claim to, not just that they compile.

## Metrics (Prometheus)

`MetricsModule` (`packages/observability/src/metrics`) provides:

- **`MetricsService`** — a shared `prom-client` `Registry`. `collectDefaultMetrics()` runs on module init (process heap, event loop lag, GC pauses, file descriptors — the standard Node.js process metrics, "for free").
- **`HttpMetricsInterceptor`** — records `http_request_duration_seconds` (histogram) and `http_requests_total` (counter) for every request, labeled by `method`, `route`, `status_code`.
- **`MetricsController`** — `GET /metrics`, the Prometheus scrape target.

### Cardinality discipline

`HttpMetricsInterceptor` labels by the **matched route** (`/v1/accounts/:id`), not the raw URL (`/v1/accounts/9f2c...`). This is the single most common way a metrics system silently degrades in production: labeling by raw URL creates a new, ever-growing label series per unique resource id, and Prometheus's memory usage is driven by the number of distinct label combinations. Using the route pattern keeps the label cardinality bounded by the number of *endpoints*, not the number of *requests* — deliberate, not an oversight, and worth stating explicitly since it's exactly the kind of thing that looks fine in dev and pages someone at 3am in production once real traffic volume exists.

`/metrics` is deliberately **not** versioned (`/v1/metrics`) — it's Prometheus's scrape contract, not a public API surface, and coupling it to `enableVersioning`'s default would make every scrape config brittle against an unrelated API-versioning decision.

### Prometheus Integration (prepared, not deployed)

```yaml
# infrastructure/monitoring/prometheus.yml (already scaffolded in Phase 1,
# extend with real scrape targets once services are deployed)
scrape_configs:
  - job_name: 'ecoswift-api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: /metrics
```

Every app that imports `MetricsModule` exposes a scrapable `/metrics` endpoint the moment it's running — Prometheus config just needs a target list, which is an infrastructure/deployment concern (Phase 2C's job is to make every service scrapable, not to run a Prometheus server, which belongs in Phase 2C's infra provisioning or later).

### Grafana Integration (prepared, not deployed)

No dashboards are shipped in this phase — there's no traffic yet to build a meaningful dashboard from. What *is* in place: every metric name follows Prometheus/Grafana convention (`_seconds` suffix for durations, `_total` suffix for counters — both already correct in `MetricsService`), so a Grafana dashboard built against `http_request_duration_seconds`/`http_requests_total` in a later phase needs no metric renaming to work.

## Distributed Tracing (OpenTelemetry)

`startTracing(serviceName)` (`packages/observability/src/tracing/tracing.ts`) bootstraps `@opentelemetry/sdk-node` with `getNodeAutoInstrumentations()` (HTTP, Express, and — once the corresponding instrumentation packages are added to a service in a later phase — Prisma/ioredis, picked up automatically by the same auto-instrumentation call). Exports via OTLP over HTTP — vendor-neutral, works against Jaeger, Grafana Tempo, or any other OTLP-compatible collector, so the collector choice is an infra decision, not a code dependency.

### The must-be-first-import constraint

OpenTelemetry's auto-instrumentation works by monkey-patching modules (`http`, `express`, etc.) at `require()` time — it must patch a module *before* anything else has already required (and captured a reference to) the unpatched version. Concretely, this means `startTracing()` must be called before `NestFactory`, before `reflect-metadata`, before anything:

```ts
// apps/api/src/main.ts — the actual, live pattern
import { startTracing } from '@ecoswift/observability';
startTracing('ecoswift-api');

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
// ...
```

This works because the app compiles to CommonJS (`tsconfig.json`'s `"module": "commonjs"`), where `require()` calls execute in literal source order — unlike ESM's hoisted imports, which would defeat this ordering entirely. Every service's `main.ts` needs this exact structure, in this exact order, when tracing is enabled for it.

**Off by default** (`OTEL_ENABLED=false`): auto-instrumenting every module has real startup-time and per-request overhead that local development shouldn't pay for unless someone's actually debugging a tracing problem.

### Grafana Tempo / Jaeger Integration (prepared, not deployed)

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318/v1/traces   # or Jaeger's OTLP endpoint
OTEL_SERVICE_NAME=ecoswift-api
```

Any OTLP-compatible collector works without code changes — the endpoint is the only thing that differs between "point this at Jaeger locally" and "point this at the production Tempo cluster."

## Centralized Structured Logging

Already established in Phase 1 (`nestjs-pino`, every app's `logger/logger.module.ts`) and extended conceptually, not re-architected, in this phase:

- **Format**: structured JSON in staging/production; `pino-pretty` in development for human readability. Never plain-text log lines — a JSON log line is a queryable fact, a text log line is something you grep and hope.
- **Redaction**: `Authorization`/`Cookie` headers are redacted at the logger level (Phase 1), not left to callers to remember not to log.
- **Correlation**: every log line inside a request's lifecycle can be tied back to `x-correlation-id` (propagated) and `x-request-id` (per-hop) — see § Correlation & Request IDs below. Combined with `RequestContext` (`@ecoswift/http`), a logger call anywhere in a deeply nested call chain can pull the current correlation id from `AsyncLocalStorage` without it being passed as an explicit parameter.

### Log Aggregator Integration (prepared, not deployed)

JSON-formatted stdout is the universal input format for every major log aggregator (Loki, CloudWatch Logs, Datadog, Elastic) — none of them need a special agent baked into the app itself, just something shipping container stdout to the aggregator, which is a deployment/infra concern for a later phase.

## Correlation IDs & Request IDs

Two distinct, complementary identifiers (`packages/observability/src/middleware`):

- **`CorrelationIdMiddleware`**: propagates an existing `x-correlation-id` if the incoming request already has one (e.g. forwarded from an upstream gateway or a triggering event), generates a new one only at a chain's true origin. Spans a whole logical operation — client request → gateway → service → published event → worker that consumes it — all sharing one correlation id, which is what makes "show me everything that happened because of this one customer action" possible across service and process boundaries.
- **`RequestIdMiddleware`**: always freshly generated per request, identifying exactly one hop. Useful for pinpointing one specific request/log line/trace span even when correlation id is (correctly) shared across many.

Both are the canonical, shared versions of what every Phase 1 app scaffolded its own copy of — `apps/api`'s local `correlation-id.middleware.ts` has been removed in favor of the shared package as part of this phase's reference integration; other services adopt the shared version as they're touched in later phases.

`RequestContext` (`@ecoswift/http`, `AsyncLocalStorage`-backed) makes both ids (plus, once auth exists, the acting user) available anywhere in a request's async call chain without threading them through every function signature — populated once per request by `RequestContextMiddleware`, read via `RequestContext.correlationId` / `RequestContext.get()`.

**Verified live**: a plain `GET /v1/health` request against the running reference integration returned both `x-correlation-id` and `x-request-id` response headers, each a valid, freshly generated UUID.

## Alerting Hooks (prepared, not deployed)

No alerting rules ship in this phase — alert thresholds tuned against a system with zero real traffic are guesses, not engineering. What *is* in place, ready for Phase 2C's infra provisioning or a later phase to wire up:

- Every service's `/metrics` and `/v1/health/ready` are the two inputs any alerting system (Prometheus Alertmanager, Grafana alerting, a hosted APM) needs — request error rate and latency from the former, dependency health from the latter.
- The dead-letter streams/queues (`events:dead-letter:<type>` in Redis Streams, BullMQ's failed-job retention — see `queues.md`) are natural alert sources once wired up: "dead-letter stream depth > 0" is a much earlier, more actionable signal than "customers are complaining that transfers aren't completing."
- `SecurityEvent`/`AuditLog` rows (Phase 2B schema) are the natural source for security alerting (repeated `SUSPICIOUS_LOGIN`, a spike in `LOGIN_FAILURE`) once a real SIEM or alerting pipeline consumes them — the data is being captured; routing it to a pager is a Phase 2C infra or later decision.

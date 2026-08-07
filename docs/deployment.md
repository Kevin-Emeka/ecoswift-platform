# Deployment Guide — Milestone 1 (Sandbox / Development)

This guide covers deploying the full Milestone 1 stack — landing site, customer
portal, admin panel, and every backend service — for local development and
demonstration. Everything described here runs in **sandbox mode**: simulated
deposits/withdrawals are clearly labeled `[SANDBOX]` end to end (API
responses, receipts, console-logged emails/SMS) and never touch a real
banking network.

## Quick start — Docker Compose

```bash
cp .env.example .env      # defaults are already correct for a from-scratch deploy
docker compose up --build
```

This brings up, in dependency order:

1. **`postgres`** and **`redis`** — datastores, each with a health check.
2. **`migrate`** — a one-shot container that runs `pnpm db:deploy && pnpm
   db:seed` once `postgres` is healthy, then exits. Every other service
   depends on this completing successfully before it starts, so migrations
   and seed data are always in place automatically — no manual step required.
3. **Backend services**, each with its own published port and a
   `GET /v1/health` check: `auth-service` (3000), `api` (3001, gateway
   scaffold — not on the customer-facing path), `account-service` (3003),
   `notification-service` (3004), `receipt-service` (3005), `audit-service`
   (3006), `email-service` (3007), `sms-service` (3008).
4. **`admin`** (3100) and **`customer-portal`** (3200) — Next.js apps, once
   their backing services report healthy.
5. **`nginx`** (8080) — reverse proxy fronting `admin`/`customer-portal`/`api`.

Open:

- Customer portal: http://localhost:3200
- Admin panel: http://localhost:3100 (break-glass account:
  `admin@ecoswiftbank.com`, password reset required on first use — see the
  seed output)

Validate the compose file without starting anything:

```bash
docker compose config --quiet
```

## Building in a network-restricted environment

The Dockerfiles fetch nothing from the network at build time — pnpm itself,
the pnpm package store, and Prisma's platform engine binaries are all
vendored into the repo under `infrastructure/docker/vendor/` and installed
with `--offline`. This exists because the sandbox this milestone was built
in TLS-intercepts outbound HTTPS from inside containers with no trusted CA
installed, which breaks the normal approach (`corepack prepare
pnpm@9.15.0`, live `pnpm install`, `prisma generate` fetching engines from
`binaries.prisma.sh`) outright. If your environment has normal outbound
network access, none of this matters — the build works either way. If you
ever need to refresh the vendored contents (e.g. after a pnpm-lock.yaml or
Prisma version bump), regenerate them from a machine with real network
access:

```bash
# pnpm itself + its content-addressable store (must be v3 format — pnpm 9.x,
# not whatever "pnpm --version" reports if a newer pnpm self-manages the
# pin transparently; check with `pnpm store path`)
npm pack pnpm@9.15.0   # extract into infrastructure/docker/vendor/pnpm

# any package pnpm install --offline reports missing, or a new platform
# binary (e.g. @turbo/linux-64, @next/swc-linux-x64-musl) — fetch into an
# isolated scratch dir pinned to packageManager: pnpm@9.15.0, targeting
# this repo's vendor store directly:
#   pnpm install --store-dir=infrastructure/docker/vendor/pnpm-store

# Prisma's linux-musl query/schema engines (separate CDN, same problem):
#   add `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to
#   prisma/schema.prisma's generator block, then:
PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x pnpm db:generate
# copy the two resulting binaries into infrastructure/docker/vendor/prisma-engines-direct/
```

`nginx:1.27-alpine`'s image pull hit an intermittent CDN blob-download
failure in the sandbox this was built in, unrelated to anything above —
plain `docker pull nginx:1.27-alpine` retried failed the same way a few
times before succeeding, well within normal transient-network-blip
territory. If `docker compose up` fails only on the `nginx` step, retry
just that service: `docker compose up -d nginx`. Every other service is
reachable directly on its own port regardless (see the port list above),
so this doesn't block using the platform even if the retry is still flaky.

## Local dev (`pnpm dev`), without Docker

With a reachable Postgres and Redis (`docker compose up postgres redis -d`,
or any local install), every service and both frontends also run directly:

```bash
cp .env.example .env
pnpm install
pnpm db:deploy && pnpm db:seed

# each service also needs its own .env (PORT + connection vars) —
# every services/*/.env.example is ready to copy as-is:
for svc in auth-service account-service notification-service receipt-service audit-service email-service sms-service; do
  cp "services/$svc/.env.example" "services/$svc/.env"
done

pnpm dev   # starts every workspace via Turborepo in one command
```

## What was verified end to end

Both the Docker Compose path and the local-dev path were used to prove the
milestone's actual stop condition — a real Postgres and Redis, real HTTP
calls, no mocks:

1. `POST /v1/auth/register` (auth-service) → customer + user created,
   welcome + verification emails enqueued.
2. `email-service`'s worker (BullMQ, `EMAIL_QUEUE`) picks up both jobs and
   "sends" them through the sandbox-default `ConsoleEmailAdapter`, which
   logs the fully-rendered subject **and body** — including the real
   verification link — to its own console output.
3. `POST /v1/auth/verify-email` with that token → account activated.
4. `POST /v1/auth/login` → real JWT access/refresh tokens.
5. `POST /v1/accounts` (account-service, JWT verified against auth-service's
   session table) → a new account with a unique account number.
6. `POST /v1/accounts/:id/activate`, then `POST
   /v1/accounts/:id/transactions/deposit` and `/withdraw` → real
   double-entry postings, `sandbox: true` on every response, receipts
   enqueued to `receipt-service`.
7. `GET /v1/accounts/:id` / `GET /v1/accounts/:id/transactions` → correct
   balance and history.
8. `PATCH /v1/customers/me`, `POST /v1/auth/change-password` → both persist.
9. `GET /v1/notifications` (notification-service) → the full trail of
   system emails for that user.
10. `POST /v1/auth/logout` → session revoked; the same access token is
    immediately rejected (`401 Session is no longer active`) by every other
    service, confirming cross-service session revocation actually works,
    not just token expiry.

`customer-portal` (3200) and `admin` (3100) were both confirmed serving
every page (homepage, product, pricing, FAQ, contact, privacy, terms,
login, register, dashboard, accounts, admin login) against the live,
containerized backend — all 12 `docker compose` services (postgres, redis,
migrate, the 7 backend services, admin, customer-portal) reporting healthy.

### Bugs this live pass caught that neither unit tests nor a partial build could

Unit tests mock every external dependency by design, and earlier attempts
never got far enough to reach these — all are fixed in the current code:

- **BullMQ workers crashed on boot** (`Error: Your redis options
  maxRetriesPerRequest must be null`) — every queue consumer reused
  `@ecoswift/cache`'s shared Redis client, which isn't configured the way
  BullMQ requires for its blocking commands. `BaseWorker` now derives a
  dedicated connection for the `Worker` itself. `app.module.spec.ts` never
  caught it because it only calls `.compile()`, never `.init()`, so
  `onModuleInit()` (where the crash happens) never ran under test.
- **Every new service defaulted to port 3000 outside Docker** — Docker
  Compose sets `PORT` per service explicitly, masking that each
  `config/configuration.ts` had copy-pasted the same `'3000'` fallback.
  Fixed per service; stale `.env.example` port numbers corrected to match.
- **The sandbox email adapter only logged the subject line**, never the
  body — the verification link was never visible anywhere, making
  registration→verification impossible to complete under the documented
  default (`EMAIL_DRIVER=console`). Fixed to log the full body.
- **`prisma/seed.ts`'s notification-template upsert had `update: {}`** —
  editing a template's content in `seed.ts` never propagated to an
  already-seeded database. Fixed to `update: { ...template }`.
- **The Dockerfiles built each app with plain `pnpm --filter X build`**,
  not `turbo run build --filter=X` — meaning `@ecoswift/database`,
  `@ecoswift/authz`, and every other workspace dependency an app imports
  never got built first, since only `turbo`'s `^build` graph (the same one
  `pnpm build` at the repo root already uses) knows to do that. Every app
  build failed with `Cannot find module '@ecoswift/*'` until fixed.
  Relatedly, stale `*.tsbuildinfo` files (TypeScript's incremental-build
  cache) were getting copied into the build context while `.dockerignore`
  excluded the `dist/` they referenced — `tsc` saw the stale cache and
  believed it was already built, so `@ecoswift/types`/`@ecoswift/utils`
  silently produced no output at all. Fixed by excluding `**/*.tsbuildinfo`
  too.
- **Every backend service's Docker healthcheck hit `/health`**, but the
  actual route is versioned at `/v1/health` — every healthcheck would have
  reported unhealthy forever, permanently blocking `admin`/`customer-portal`
  (which `depends_on: condition: service_healthy`) from ever starting.
- **`admin`/`customer-portal` listened on Next.js's default port 3000
  inside the container**, not 3100/3200 — `next start` takes no port
  argument in the Dockerfile, so despite `ports: "3100:3100"` mapping the
  host correctly, nothing was listening on 3100 inside the container to
  receive it (and nginx's `proxy_pass admin:3100` would have failed the
  same way). Fixed by setting `PORT` per service in `docker-compose.yml`,
  which `next start` respects automatically.

## Sandbox/test data disclosure

Every simulated financial operation is labeled, not just internally but in
every place a user or reviewer would see it:

- Transaction `description` is prefixed `[SANDBOX]`.
- Every transaction/receipt API response includes `sandbox: true`.
- `SandboxTransactionService.assertSandboxEnabled()` refuses to run at all
  when `NODE_ENV=production`, so this code path cannot be reached in a real
  deployment.

## Environment variables

Root `.env.example` documents the full list (database, Redis, JWT, SMTP,
Twilio, driver selection for email/SMS). Each service also has its own
`services/*/.env.example` scoped to just what it needs. `EMAIL_DRIVER` and
`SMS_DRIVER` default to `console` (sandbox-safe, logs instead of sending) —
set them to `smtp`/`twilio` with real credentials to actually send mail/SMS.

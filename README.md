# Ecoswift Bank — Platform Monorepo

Production-grade monorepo foundation for **Ecoswift Bank** (`ecoswiftbank.com`) — *Smart Digital Banking Platform*.

> **Milestone 1 status:** end-to-end sandbox MVP — registration, email verification, login, account opening, simulated deposits/withdrawals, transaction history, profile/security settings, and the customer + admin portals are all implemented and running. See [`docs/architecture.md`](docs/architecture.md) for the full folder-by-folder breakdown and [`docs/deployment.md`](docs/deployment.md) for how to run it.

## Overview

Ecoswift Bank is built as a TurboRepo-managed pnpm monorepo, separating **customer/admin-facing applications** (`apps/`) from **backend domain microservices** (`services/`) and **shared libraries** (`packages/`). This structure lets each banking capability (auth, transactions, loans, KYC, etc.) evolve as an independently deployable service while sharing types, configuration, database access, and UI primitives.

## Brand & Surfaces

Single source of truth for these values in code: [`packages/config/src/branding.ts`](packages/config/src/branding.ts).

| | |
|---|---|
| Organization | Ecoswift Bank |
| Short name | ESB |
| Tagline | Smart Digital Banking Platform |
| Public website & customer portal | https://www.ecoswiftbank.com (one app; the bare `ecoswiftbank.com` apex redirects here) |
| API base URL | https://api.ecoswiftbank.com |
| Admin portal | https://admin.ecoswiftbank.com |
| Developer portal | https://developers.ecoswiftbank.com |
| Status page | https://status.ecoswiftbank.com |
| Documentation | https://docs.ecoswiftbank.com |
| Support | support@ecoswiftbank.com |
| Help desk | help@ecoswiftbank.com |
| Security | security@ecoswiftbank.com |
| No-reply | noreply@ecoswiftbank.com |
| Notifications | notifications@ecoswiftbank.com |

These production URLs are wired into local dev via `API_BASE_URL`, `ADMIN_PORTAL_URL`, `CUSTOMER_PORTAL_URL`, `DEVELOPER_PORTAL_URL`, `STATUS_PAGE_URL`, and `DOCS_URL` in [`.env.example`](.env.example) (dev defaults to `localhost`; staging/prod override with the real subdomains above).

## Tech Stack

| Concern | Technology |
|---|---|
| Monorepo | TurboRepo, pnpm workspaces |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Shadcn UI |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Cache | Redis |
| Containers | Docker, Docker Compose |
| Web server | Nginx (reverse proxy) |
| Testing | Jest (unit/integration), Playwright (e2e, added per-app) |
| Code quality | ESLint (flat config), Prettier, Husky, lint-staged |
| CI/CD | GitHub Actions |
| Logging | Pino (`nestjs-pino`), structured JSON |

## Folder Structure

```
ecoswift-platform/
├── apps/                 # Deployable applications (gateways + frontends)
│   ├── api/               # Core backend API gateway (NestJS)
│   ├── admin/              # Internal admin dashboard (Next.js)
│   ├── customer-portal/    # Customer-facing web app (Next.js)
│   └── mobile-api/         # Mobile BFF gateway (NestJS)
├── services/              # Backend domain microservices (NestJS)
│   ├── auth-service/ transaction-service/ account-service/
│   ├── notification-service/ receipt-service/ email-service/ sms-service/
│   └── loan-service/ savings-service/ reporting-service/ audit-service/ kyc-service/
├── packages/              # Shared libraries consumed by apps & services
│   ├── ui/ shared/ config/ database/ types/ utils/
├── infrastructure/        # Docker, Nginx, monitoring, logging, IaC
├── prisma/                 # Single Prisma schema (shared datasource)
├── docs/                  # Architecture & engineering docs
├── scripts/                # Local dev bootstrap scripts
└── .github/workflows/      # CI pipelines
```

Full rationale for every folder lives in [`docs/architecture.md`](docs/architecture.md).

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`corepack enable` or `npm install -g pnpm`)
- Docker + Docker Compose (for local Postgres/Redis or the full containerized stack)

## Installation

```bash
git clone <repo-url> ecoswift-platform
cd ecoswift-platform
cp .env.example .env      # fill in real values
pnpm install
pnpm db:generate           # generates the Prisma client
```

Or run the bootstrap script which does all of the above:

```bash
./scripts/setup.sh
```

## Development

Run every app/service in watch mode via TurboRepo:

```bash
pnpm dev
```

Run a single workspace:

```bash
pnpm --filter @ecoswift/api dev
pnpm --filter @ecoswift/admin dev
```

Bring up just the datastores (Postgres + Redis) and run apps locally against them:

```bash
docker compose up postgres redis -d
pnpm dev
```

## Docker

Run the full containerized stack — Postgres, Redis, every backend service, Admin, Customer Portal, Nginx:

```bash
docker compose up --build
```

| Service | Port |
|---|---|
| Customer Portal | `http://localhost:3200` |
| Admin | `http://localhost:3100` |
| Nginx (routes `/api`, `/admin`, `/`) | `http://localhost:8080` |
| auth-service | `http://localhost:3000` |
| api (gateway scaffold) | `http://localhost:3001` |
| account-service | `http://localhost:3003` |
| notification-service | `http://localhost:3004` |
| receipt-service | `http://localhost:3005` |
| audit-service | `http://localhost:3006` |
| email-service | `http://localhost:3007` |
| sms-service | `http://localhost:3008` |

Validate the compose file without starting anything:

```bash
docker compose config --quiet
```

Full deployment instructions — including the local (non-Docker) dev path and
a known Docker networking caveat in network-restricted sandboxes — are in
[`docs/deployment.md`](docs/deployment.md).

## Available Commands

Run from the repo root (delegated to every workspace via TurboRepo):

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps/services in watch mode |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm test` | Run unit tests in all workspaces |
| `pnpm test:e2e` | Run e2e tests where configured |
| `pnpm format` / `format:check` | Prettier write/check across the repo |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:migrate` | Run Prisma migrations (dev) |

## Coding Standards

- **SOLID principles** and **Clean Architecture** layering: controllers → services → repositories, with dependencies pointing inward.
- **Domain-Driven Design**: each `services/*` app owns a single bounded context; shared concepts live in `packages/`, never duplicated.
- **Dependency Injection** throughout via Nest's DI container — no manual `new` of services/repositories in application code.
- **Repository pattern** for data access once domain models are introduced, keeping Prisma usage out of controllers/services.
- **Feature-first organization**: features live under `src/modules/<feature>` with their own controller/service/DTOs, not spread across generic `controllers/`, `services/` folders.
- Formatting and linting are enforced automatically pre-commit via Husky + lint-staged; CI re-checks lint, types, build, and tests on every PR.

## Environment Variables

See [`.env.example`](.env.example) for the full list (database, Redis, JWT, SMTP, AWS, Twilio, and the public surface URLs listed under [Brand & Surfaces](#brand--surfaces)). Each app also has a scoped `.env.example` documenting the subset and port it needs.

## License

Proprietary — see [`LICENSE`](LICENSE).

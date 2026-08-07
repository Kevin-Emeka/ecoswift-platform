# Docker

Generic, parameterized Dockerfiles used by every app/service in the
monorepo (leveraging `turbo prune` so each image only ships the workspace
subset it actually needs):

- `Dockerfile.nestjs` — any NestJS app under `apps/` or `services/`
- `Dockerfile.nextjs` — any Next.js app under `apps/`

`docker-compose.yml` at the repo root wires these together for local
development. Production deployments build/push per-app images using the
same Dockerfiles with a different `APP_NAME` build arg.

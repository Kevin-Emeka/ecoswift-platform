#!/usr/bin/env bash
# One-shot local dev bootstrap: env file, dependencies, Prisma client.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in real secrets before running services."
fi

echo "Installing dependencies..."
pnpm install

echo "Generating Prisma client..."
pnpm db:generate

echo "Done. Run 'pnpm dev' to start every app, or 'docker compose up' for the containerized stack."

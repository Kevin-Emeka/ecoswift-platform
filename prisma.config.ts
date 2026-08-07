import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (replaces the deprecated `package.json#prisma`
 * key). Schema and seed paths are relative to this file's location.
 *
 * A config file (this one) disables the Prisma CLI's previous automatic
 * `.env` loading — `dotenv/config` above replaces that explicitly, so
 * `prisma migrate`/`validate`/`studio` (which talk to the schema engine
 * directly, not through the generated Client) still see `DATABASE_URL`.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});

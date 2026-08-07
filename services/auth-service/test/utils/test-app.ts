import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

/**
 * Mirrors `src/main.ts`'s `bootstrap()` (versioning, the global
 * `ValidationPipe`, cookie parsing) minus tracing/Swagger/`listen()` — e2e
 * specs run against a real `AppModule` graph (real Postgres/Redis, same as
 * `pnpm docker:up`) via `supertest`, not `app.listen()`, so every request
 * path an e2e spec exercises behaves exactly like the live service,
 * including request validation and the `/v1/...` URI prefix.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  app.use(cookieParser());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.init();
  return app;
}

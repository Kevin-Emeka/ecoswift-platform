import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../../src/app.module';

/**
 * Mirrors `src/main.ts`'s `bootstrap()` (versioning, the global
 * `ValidationPipe`) minus headers/CORS/Swagger/`listen()` — e2e specs run
 * against a real `AppModule` graph (real Postgres/Redis) via `supertest`,
 * same pattern as auth-service's `test/utils/test-app.ts`.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.init();
  return app;
}

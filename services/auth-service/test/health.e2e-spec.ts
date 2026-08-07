import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/v1/health (GET) reports status', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect((res) => {
        expect([200, 503]).toContain(res.status);
      });
  });
});

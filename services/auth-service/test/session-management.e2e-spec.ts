import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@ecoswift/database';
import { ConfigurationService } from '@ecoswift/config';
import { createTestApp } from './utils/test-app';

/**
 * Covers session management beyond the primary auth-flow.e2e-spec.ts:
 * multiple concurrent devices, the `session.max_concurrent` eviction policy
 * (business-rules.md § Session Policy), and self-service session listing /
 * revocation via `/v1/sessions`.
 */
describe('Session management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e.sessions.${randomUUID()}@example.com`;
  const password = 'E2eTestPass!2026';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const country = await prisma.country.findFirstOrThrow();

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Chidi',
        lastName: 'Nwosu',
        dateOfBirth: '1988-11-02',
        countryId: country.id,
      });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE', emailVerifiedAt: new Date() } });
  });

  afterAll(async () => {
    // Same FK-ordering note as auth-flow.e2e-spec.ts's afterAll — Customer
    // has no cascade delete off User by design.
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.customer.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('evicts the oldest active session once session.max_concurrent is exceeded', async () => {
    const configurationService = app.get(ConfigurationService);
    const maxConcurrent = await configurationService.getNumber('session.max_concurrent', 5);

    let lastAccessToken = '';
    for (let i = 0; i < maxConcurrent + 1; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('User-Agent', `session-test-agent-${i}/1.0`)
        .send({ email, password });
      expect(res.status).toBe(200);
      lastAccessToken = res.body.accessToken;
    }

    const sessionsRes = await request(app.getHttpServer())
      .get('/v1/sessions')
      .set('Authorization', `Bearer ${lastAccessToken}`);

    expect(sessionsRes.status).toBe(200);
    expect(sessionsRes.body).toHaveLength(maxConcurrent);
    // The very first agent's session should have been the one evicted, not the newest login.
    expect(sessionsRes.body.map((s: { userAgent: string }) => s.userAgent)).not.toContain('session-test-agent-0/1.0');
  });

  it("lets a user revoke one of their own sessions by id, but not another user's", async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('User-Agent', 'revoke-target-agent/1.0')
      .send({ email, password });
    const accessToken = loginRes.body.accessToken;

    const sessionsRes = await request(app.getHttpServer())
      .get('/v1/sessions')
      .set('Authorization', `Bearer ${accessToken}`);
    const targetSession = sessionsRes.body.find(
      (s: { userAgent: string; isCurrent: boolean }) => !s.isCurrent,
    );
    expect(targetSession).toBeDefined();

    const revokeRes = await request(app.getHttpServer())
      .delete(`/v1/sessions/${targetSession.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(revokeRes.status).toBe(200);

    const revoked = await prisma.session.findUniqueOrThrow({ where: { id: targetSession.id } });
    expect(revoked.status).toBe('REVOKED');
  });

  it('rejects revoking a session id that does not belong to the caller (403, not a leaking 404)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('User-Agent', 'ownership-check-agent/1.0')
      .send({ email, password });

    // Simulate a foreign session id by pointing at a session owned by a
    // different (throwaway) user, not this test's own account.
    const foreignUser = await prisma.user.create({
      data: {
        email: `e2e.foreign.${randomUUID()}@example.com`,
        passwordHash: 'unused-in-this-test',
        actorType: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    const foreignSession = await prisma.session.create({
      data: { userId: foreignUser.id, ipAddress: '10.0.0.2', status: 'ACTIVE', expiresAt: new Date(Date.now() + 60_000) },
    });

    const res = await request(app.getHttpServer())
      .delete(`/v1/sessions/${foreignSession.id}`)
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(403);

    await prisma.session.delete({ where: { id: foreignSession.id } });
    await prisma.user.delete({ where: { id: foreignUser.id } });
  });
});

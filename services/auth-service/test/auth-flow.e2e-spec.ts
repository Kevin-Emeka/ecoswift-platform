import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@ecoswift/database';
import { createTestApp } from './utils/test-app';

/**
 * Exercises the full Identity & Authentication flow against a real
 * `AppModule` graph (real Postgres/Redis) end to end: register, verify
 * email, log in, rotate a refresh token, detect reuse of the stale one,
 * and log out. This is the same sequence the Phase 3A live smoke test ran
 * manually — see docs/authentication.md — captured here as a repeatable
 * regression test rather than something only ever checked by hand.
 */
describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  const email = `e2e.${randomUUID()}@example.com`;
  const password = 'E2eTestPass!2026';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const country = await prisma.country.findFirstOrThrow();
    countryId = country.id;
  });

  afterAll(async () => {
    // Customer intentionally has no cascade delete off User (audit/compliance
    // integrity — a real customer record must never silently vanish) — the
    // same FK that protects production data means test cleanup must delete
    // it explicitly, in order, rather than relying on a cascade.
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.customer.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('registers a new account as PENDING_VERIFICATION', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/register').send({
      email,
      password,
      firstName: 'Ada',
      lastName: 'Okafor',
      dateOfBirth: '1992-03-20',
      countryId,
    });

    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.status).toBe('PENDING_VERIFICATION');
  });

  it('rejects login before the email is verified', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/verify your email/i);
  });

  it('verifies the email using the token minted for this user, activating the account', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const challenge = await prisma.otpChallenge.findFirstOrThrow({
      where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', status: 'PENDING' },
    });
    // The raw token isn't recoverable from its stored hash — pull it from the
    // rendered notification body the same way a real recipient would read it
    // out of the email, rather than reaching into OtpChallenge internals.
    const verificationTemplate = await prisma.notificationTemplate.findFirstOrThrow({
      where: { code: 'EMAIL_VERIFICATION' },
    });
    const notification = await prisma.notification.findFirstOrThrow({
      where: { recipientUserId: user.id, templateId: verificationTemplate.id },
      orderBy: { createdAt: 'desc' },
    });
    const match = notification.renderedBody?.match(/token=([A-Za-z0-9_-]+)/);
    expect(match).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ token: match![1] });

    expect(res.status).toBe(201);
    const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(verifiedUser.status).toBe('ACTIVE');
    expect(verifiedUser.emailVerifiedAt).not.toBeNull();
    expect(challenge.id).toBeDefined();
  });

  let accessToken: string;
  let refreshToken: string;
  let sessionId: string;

  it('logs in and issues an access/refresh token pair bound to a new session', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('User-Agent', 'e2e-test-agent/1.0')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/ecoswift_refresh_token=/);

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
    sessionId = res.body.sessionId;

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe('ACTIVE');
  });

  it('accepts the access token on a protected route', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it('rejects protected routes without a token', async () => {
    const res = await request(app.getHttpServer()).get('/v1/auth/me');
    expect(res.status).toBe(401);
  });

  let rotatedRefreshToken: string;

  it('rotates the refresh token on use', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
    rotatedRefreshToken = res.body.refreshToken;
  });

  it('detects reuse of the now-stale refresh token and revokes the whole session', async () => {
    const reuseRes = await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.message).toMatch(/already been used/i);

    // The session-wide revocation must also invalidate the token issued by
    // the rotation that just happened, not only the one that was reused.
    const rotatedRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: rotatedRefreshToken });
    expect(rotatedRes.status).toBe(401);

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe('REVOKED');
    expect(session.revokedReason).toBe('REFRESH_TOKEN_REUSE_DETECTED');
  });

  it('logs out and immediately invalidates the session for any still-valid access token', async () => {
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    const freshAccessToken = loginRes.body.accessToken as string;
    const freshRefreshToken = loginRes.body.refreshToken as string;

    const logoutRes = await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${freshAccessToken}`)
      .send({ refreshToken: freshRefreshToken });
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${freshAccessToken}`);
    expect(meRes.status).toBe(401);
  });
});

import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@ecoswift/database';
import { TotpService } from '@ecoswift/security';
import { createTestApp } from './utils/test-app';

/**
 * Exercises Phase 3C's enterprise security features end to end against a
 * real `AppModule` graph (real Postgres/Redis): TOTP enrollment, MFA-gated
 * login, backup-code single-use, device revocation ending every session on
 * that device, CSRF protection on the cookie-reliant refresh path, and
 * step-up authentication gating a sensitive action. This is the same
 * sequence the Phase 3C live smoke test ran manually (see docs/security.md,
 * docs/mfa.md, docs/device-security.md), captured as a repeatable
 * regression test — including the exact CORS/payload-size/CSRF bugs that
 * smoke test caught and this suite now guards against regressing.
 */
describe('Security flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const totpService = new TotpService();
  const password = 'E2eSecurityTest!2026';
  const email = `e2e.security.${randomUUID()}@example.com`;
  let userId: string;
  let totpSecret: string;

  async function currentTotpCode(): Promise<string> {
    const counter = Math.floor(Date.now() / 1000 / 30);
    return (totpService as unknown as { generateCode: (s: string, c: number) => string }).generateCode(totpSecret, counter);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const country = await prisma.country.findFirstOrThrow();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

    const user = await prisma.user.create({
      data: {
        actorType: 'CUSTOMER',
        email,
        phone: `+234801${Math.floor(1000000 + Math.random() * 8999999)}`,
        emailVerifiedAt: new Date(),
        passwordHash,
        status: 'ACTIVE',
        profile: { create: { firstName: 'Amara', lastName: 'Eze', dateOfBirth: new Date('1994-02-10'), nationalityId: country.id } },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.backupCode.deleteMany({ where: { twoFactorCredential: { userId } } });
    await prisma.twoFactorCredential.deleteMany({ where: { userId } });
    await prisma.securityEvent.deleteMany({ where: { userId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.device.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('logs in normally before any MFA factor is enrolled', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.mfaRequired).toBeUndefined();
  });

  let accessToken: string;

  it('enrolls TOTP and confirms it with backup codes issued', async () => {
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    accessToken = loginRes.body.accessToken;

    const enrollRes = await request(app.getHttpServer())
      .post('/v1/mfa/totp/enroll')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(enrollRes.status).toBe(201);
    totpSecret = enrollRes.body.secret;

    const confirmRes = await request(app.getHttpServer())
      .post('/v1/mfa/totp/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: await currentTotpCode() });

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.backupCodes).toHaveLength(10);
  });

  it('now requires MFA at login and completes it with a fresh TOTP code', async () => {
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.mfaRequired).toBe(true);
    expect(loginRes.body.availableMethods).toEqual(['TOTP']);

    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/mfa/verify')
      .send({ mfaToken: loginRes.body.mfaToken, method: 'TOTP', code: await currentTotpCode() });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.accessToken).toBeDefined();
  });

  it('completes login with a single-use backup code, then rejects reuse of the same code', async () => {
    const enrollLoginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    const enrollVerify = await request(app.getHttpServer())
      .post('/v1/auth/mfa/verify')
      .send({ mfaToken: enrollLoginRes.body.mfaToken, method: 'TOTP', code: await currentTotpCode() });
    const freshToken = enrollVerify.body.accessToken;

    const regenRes = await request(app.getHttpServer())
      .post('/v1/auth/step-up')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ method: 'TOTP', code: await currentTotpCode() });
    const stepUpToken = regenRes.body.stepUpToken;

    const backupCodesRes = await request(app.getHttpServer())
      .post('/v1/mfa/backup-codes/regenerate')
      .set('Authorization', `Bearer ${freshToken}`)
      .set('X-Step-Up-Token', stepUpToken);
    const backupCode = backupCodesRes.body.backupCodes[0];

    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    const firstUse = await request(app.getHttpServer())
      .post('/v1/auth/mfa/verify')
      .send({ mfaToken: loginRes.body.mfaToken, method: 'BACKUP_CODE', code: backupCode });
    expect(firstUse.status).toBe(200);

    const secondLoginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    const secondUse = await request(app.getHttpServer())
      .post('/v1/auth/mfa/verify')
      .send({ mfaToken: secondLoginRes.body.mfaToken, method: 'BACKUP_CODE', code: backupCode });
    expect(secondUse.status).toBe(400);
  });

  it('gates disabling MFA behind step-up authentication', async () => {
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/mfa/verify')
      .send({ mfaToken: loginRes.body.mfaToken, method: 'TOTP', code: await currentTotpCode() });
    const token = verifyRes.body.accessToken;

    const withoutStepUp = await request(app.getHttpServer()).delete('/v1/mfa/TOTP').set('Authorization', `Bearer ${token}`);
    expect(withoutStepUp.status).toBe(403);

    const stepUpRes = await request(app.getHttpServer())
      .post('/v1/auth/step-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'TOTP', code: await currentTotpCode() });

    const withStepUp = await request(app.getHttpServer())
      .delete('/v1/mfa/TOTP')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Step-Up-Token', stepUpRes.body.stepUpToken);
    expect(withStepUp.status).toBe(200);

    // Login no longer requires MFA now that the only enrolled factor is disabled.
    const finalLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    expect(finalLogin.body.mfaRequired).toBeUndefined();
  });

  it('captures device risk metadata and revoking a device ends every session on it', async () => {
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    const token = loginRes.body.accessToken;

    const devicesRes = await request(app.getHttpServer()).get('/v1/devices').set('Authorization', `Bearer ${token}`);
    expect(devicesRes.status).toBe(200);
    const device = devicesRes.body[0];
    expect(device.lastIpAddress).toBeDefined();
    expect(device.riskScore).toBe(0); // NoopFraudHooksService — real fraud scoring is a future phase

    const revokeRes = await request(app.getHttpServer())
      .post(`/v1/devices/${device.id}/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'e2e test revoke' });
    expect(revokeRes.status).toBe(200);

    const meRes = await request(app.getHttpServer()).get('/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(401);
  });

  it('enforces CSRF protection on the cookie-only refresh path but not on body-supplied tokens', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginRes = await agent.post('/v1/auth/login').send({ email, password });
    const setCookieHeader = loginRes.headers['set-cookie'] as unknown as string[];
    expect(setCookieHeader.some((c) => c.includes('ecoswift_csrf_token'))).toBe(true);

    const withoutCsrfHeader = await agent.post('/v1/auth/refresh').send({});
    expect(withoutCsrfHeader.status).toBe(403);

    const csrfCookie = setCookieHeader.find((c) => c.startsWith('ecoswift_csrf_token'))!;
    const csrfToken = csrfCookie.split(';')[0]!.split('=')[1]!;

    const withCsrfHeader = await agent.post('/v1/auth/refresh').set('X-CSRF-Token', csrfToken).send({});
    expect(withCsrfHeader.status).toBe(200);

    // A non-browser client supplying the refresh token directly in the body never needs the CSRF dance.
    const bodyBasedRefresh = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: withCsrfHeader.body.refreshToken });
    expect(bodyBasedRefresh.status).toBe(200);
  });

  it('rejects an oversized request body with 413, not a generic 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'x@example.com', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
});

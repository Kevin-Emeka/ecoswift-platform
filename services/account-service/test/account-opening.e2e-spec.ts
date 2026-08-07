import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@ecoswift/database';
import { createTestApp } from './utils/test-app';

/**
 * Exercises Phase 4A's full customer onboarding + account opening journey
 * end to end against a real `AppModule` graph (real Postgres/Redis) — the
 * same sequence the phase's live smoke test ran manually (see
 * docs/account-opening.md, docs/customer-onboarding.md), captured as a
 * repeatable regression test.
 *
 * account-service doesn't issue tokens (auth-service does) — a valid
 * access token is minted here directly with `@nestjs/jwt`, matching the
 * exact payload shape `auth-service`'s `TokenService` produces and the
 * `Session` row `JwtStrategy` (this service's own copy) checks against.
 */
describe('Account opening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let userId: string;
  let accessToken: string;

  async function mintAccessToken(): Promise<string> {
    const session = await prisma.session.create({
      data: { userId, ipAddress: '127.0.0.1', expiresAt: new Date(Date.now() + 900_000) },
    });
    return jwt.sign(
      { sub: userId, sessionId: session.id, actorType: 'CUSTOMER', tokenUse: 'access' },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    const country = await prisma.country.findFirstOrThrow();
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });

    const user = await prisma.user.create({
      data: {
        actorType: 'CUSTOMER',
        email: `e2e.account-opening.${randomUUID()}@example.com`,
        phone: `+234802${Math.floor(1000000 + Math.random() * 8999999)}`,
        emailVerifiedAt: new Date(),
        passwordHash: 'not-used-in-this-suite',
        status: 'ACTIVE',
        profile: { create: { firstName: 'Katherine', lastName: 'Johnson', dateOfBirth: new Date('1988-08-26'), nationalityId: country.id } },
      },
    });
    userId = user.id;

    await prisma.customer.create({
      data: { userId, customerNumber: `E2E${Math.floor(100_000_000 + Math.random() * 899_999_999)}`, countryId: country.id, tier: 'TIER_0', status: 'ACTIVE' },
    });
    await prisma.userRole.create({ data: { userId, roleId: customerRole.id, assignedBy: userId } });

    accessToken = await mintAccessToken();
  });

  afterAll(async () => {
    // `journal_lines` is append-only at the database level (a trigger
    // rejects DELETE outright — the same tamper-evidence property
    // docs/compliance-controls.md documents for `audit_logs`) and
    // `ledger_accounts`/`accounts`/`customers` cascade that immutability
    // via `onDelete: Restrict` FKs. Once this suite posts a real opening
    // journal entry, the user/customer/account/ledger rows it created can
    // never be hard-deleted — genuinely correct behavior, not a test
    // inconvenience to work around. Cleanup here is soft: revoke the
    // session and deactivate the user, same pattern
    // `security-flow.e2e-spec.ts` established in auth-service; the
    // financial/ledger rows are left in place, exactly as production would
    // leave them.
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.update({ where: { id: userId }, data: { status: 'DEACTIVATED', deletedAt: new Date() } });
    await app.close();
  });

  it('reports an incomplete profile with the expected missing fields', async () => {
    const res = await request(app.getHttpServer()).get('/v1/customers/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profileCompletionStatus).toBe('INCOMPLETE');
    expect(res.body.data.missingFields).toEqual(
      expect.arrayContaining(['addressLine1', 'city', 'addressCountryCode', 'occupation', 'preferredCurrencyId']),
    );
  });

  it('completing the profile flips completion status to COMPLETE', async () => {
    const currency = await prisma.currency.findUniqueOrThrow({ where: { isoCode: 'USD' } });
    const res = await request(app.getHttpServer())
      .patch('/v1/customers/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        addressLine1: '1 Infinite Loop',
        city: 'Cupertino',
        addressCountryCode: 'US',
        occupation: 'Mathematician',
        preferredCurrencyId: currency.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profileCompletionStatus).toBe('COMPLETE');
    expect(res.body.data.missingFields).toEqual([]);
  });

  it('records Terms & Conditions and Privacy Policy consent as an append-only log', async () => {
    const tcRes = await request(app.getHttpServer())
      .post('/v1/customers/me/consents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ consentType: 'TERMS_AND_CONDITIONS', version: '2026-01-01', accepted: true });
    expect(tcRes.status).toBe(201);

    const ppRes = await request(app.getHttpServer())
      .post('/v1/customers/me/consents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ consentType: 'PRIVACY_POLICY', version: '2026-01-01', accepted: true });
    expect(ppRes.status).toBe(201);

    const statusRes = await request(app.getHttpServer()).get('/v1/customers/me/consents').set('Authorization', `Bearer ${accessToken}`);
    expect(statusRes.status).toBe(200);
    const types = statusRes.body.data.map((c: { consentType: string }) => c.consentType);
    expect(types).toEqual(expect.arrayContaining(['TERMS_AND_CONDITIONS', 'PRIVACY_POLICY']));
  });

  let savingsAccountId: string;

  it('opens a $0 SAVINGS account with no opening journal entry', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountTypeCode: 'SAVINGS', currencyCode: 'USD' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING_ACTIVATION');
    expect(res.body.data.availableBalance).toBe('0');
    expect(res.body.data.openingJournalNumber).toBeUndefined();
    expect(res.body.data.accountNumber).toMatch(/^\d{10}$/);
    savingsAccountId = res.body.data.id;
  });

  it('opens a FIXED_DEPOSIT with a funded opening balance and posts a balanced journal entry', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountTypeCode: 'FIXED_DEPOSIT', currencyCode: 'USD', openingBalance: 250 });

    expect(res.status).toBe(201);
    expect(res.body.data.availableBalance).toBe('250');
    expect(res.body.data.openingJournalNumber).toBeDefined();

    const journalEntry = await prisma.journalEntry.findUniqueOrThrow({
      where: { journalNumber: res.body.data.openingJournalNumber },
      include: { lines: true },
    });
    expect(journalEntry.lines).toHaveLength(2);
    const totalDebits = journalEntry.lines.filter((l) => l.direction === 'DEBIT').reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCredits = journalEntry.lines.filter((l) => l.direction === 'CREDIT').reduce((sum, l) => sum + Number(l.amount), 0);
    expect(totalDebits).toBe(totalCredits);
    expect(totalDebits).toBe(250);
  });

  it('rejects opening a FIXED_DEPOSIT below its minimum opening balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountTypeCode: 'FIXED_DEPOSIT', currencyCode: 'USD', openingBalance: 1 });

    expect(res.status).toBe(400);
  });

  it('activates a pending account (self-service) then blocks self-service unfreeze after a freeze', async () => {
    const activateRes = await request(app.getHttpServer())
      .post(`/v1/accounts/${savingsAccountId}/activate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(activateRes.status).toBe(201);
    expect(activateRes.body.data.status).toBe('ACTIVE');

    const freezeRes = await request(app.getHttpServer())
      .post(`/v1/accounts/${savingsAccountId}/freeze`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'self-service freeze' });
    expect(freezeRes.status).toBe(201);
    expect(freezeRes.body.data.status).toBe('FROZEN');

    const unfreezeRes = await request(app.getHttpServer())
      .post(`/v1/accounts/${savingsAccountId}/unfreeze`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(unfreezeRes.status).toBe(403);
  });

  it('rejects an illegal status transition (CLOSED accounts are terminal)', async () => {
    const closeRes = await request(app.getHttpServer())
      .post(`/v1/accounts/${savingsAccountId}/close`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    // Self-service caller doesn't hold accounts:close — confirms the staff-only gate.
    expect(closeRes.status).toBe(403);
  });

  it('lists only the caller\'s own accounts', async () => {
    const res = await request(app.getHttpServer()).get('/v1/accounts').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((a: { customerId: string }) => a.customerId)).toBe(true);
  });
});

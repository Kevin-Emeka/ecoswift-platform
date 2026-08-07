import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@ecoswift/database';
import { createTestApp } from './utils/test-app';

/**
 * Exercises RBAC end to end against a real `AppModule` graph (real
 * Postgres/Redis): a zero-permission user is denied by default, a
 * non-sensitive role takes effect immediately, a sensitive role routes
 * through maker-checker approval, and the reviewer can never be the
 * requester. This is the same sequence the Phase 3B live smoke test ran
 * manually — see docs/authorization.md — captured as a repeatable
 * regression test.
 */
describe('Authorization flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  const password = 'E2eAuthzTest!2026';
  let passwordHash: string;

  let plainStaffUserId: string;
  let firstAdminId: string;
  let secondAdminId: string;
  let customerSupportRoleId: string;
  let systemAdministratorRoleId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const country = await prisma.country.findFirstOrThrow();
    countryId = country.id;
    passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

    const customerSupportRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CUSTOMER_SUPPORT' } });
    const systemAdministratorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SYSTEM_ADMINISTRATOR' } });
    const superAdministratorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMINISTRATOR' } });
    customerSupportRoleId = customerSupportRole.id;
    systemAdministratorRoleId = systemAdministratorRole.id;

    const makeStaffUser = async (email: string) =>
      prisma.user.create({
        data: {
          actorType: 'STAFF',
          email,
          emailVerifiedAt: new Date(),
          passwordHash,
          status: 'ACTIVE',
          profile: { create: { firstName: 'E2E', lastName: 'Test', dateOfBirth: new Date('1990-01-01'), nationalityId: countryId } },
        },
      });

    const plainStaff = await makeStaffUser(`e2e.authz.plain.${randomUUID()}@example.com`);
    const firstAdmin = await makeStaffUser(`e2e.authz.admin1.${randomUUID()}@example.com`);
    const secondAdmin = await makeStaffUser(`e2e.authz.admin2.${randomUUID()}@example.com`);
    plainStaffUserId = plainStaff.id;
    firstAdminId = firstAdmin.id;
    secondAdminId = secondAdmin.id;

    await prisma.userRole.create({ data: { userId: firstAdmin.id, roleId: superAdministratorRole.id } });
    await prisma.userRole.create({ data: { userId: secondAdmin.id, roleId: superAdministratorRole.id } });
  });

  afterAll(async () => {
    const ids = [plainStaffUserId, firstAdminId, secondAdminId];
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    // Hard-deleting these users isn't possible once they've acted as
    // `AuditLog.actorUserId` — the FK's `onDelete: SetNull` cascade needs an
    // UPDATE on audit_logs, which the append-only trigger correctly blocks
    // (the same behavior confirmed manually during Phase 3B's live smoke
    // test). Soft-deactivating is the right cleanup here, matching how
    // `AuthService.deactivateAccount()` already treats "user is gone" for
    // any account with real history attached to it.
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status: 'DEACTIVATED', deletedAt: new Date() } });
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });
    return res.body.accessToken;
  }

  it('denies a zero-permission user by default (default-deny)', async () => {
    const plainStaff = await prisma.user.findUniqueOrThrow({ where: { id: plainStaffUserId } });
    const token = await login(plainStaff.email);

    const res = await request(app.getHttpServer()).get('/v1/roles').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("a Super Administrator's effective permission set covers the whole catalog via hierarchy expansion", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: firstAdminId } });
    const token = await login(admin.email);
    const permCount = await prisma.permission.count();

    const res = await request(app.getHttpServer()).get('/v1/authorization/me/permissions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.permissions).toHaveLength(permCount);
  });

  it('assigns a non-sensitive role immediately and it takes effect without re-login', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: firstAdminId } });
    const adminToken = await login(admin.email);
    const plainStaff = await prisma.user.findUniqueOrThrow({ where: { id: plainStaffUserId } });
    const staffToken = await login(plainStaff.email);

    const assignRes = await request(app.getHttpServer())
      .post('/v1/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: plainStaffUserId, roleId: customerSupportRoleId });
    expect(assignRes.status).toBe(201);
    expect(assignRes.body.status).toBe('ASSIGNED');

    const permsRes = await request(app.getHttpServer())
      .get('/v1/authorization/me/permissions')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(permsRes.body.permissions).toContain('support_tickets:read');
  });

  it('routes a sensitive role assignment to approval instead of applying it immediately', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: firstAdminId } });
    const adminToken = await login(admin.email);

    const res = await request(app.getHttpServer())
      .post('/v1/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: plainStaffUserId, roleId: systemAdministratorRoleId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_APPROVAL');

    const held = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: plainStaffUserId, roleId: systemAdministratorRoleId } },
    });
    expect(held).toBeNull();
  });

  it('forbids the requester from approving their own sensitive-role request', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: firstAdminId } });
    const adminToken = await login(admin.email);

    const approval = await prisma.roleAssignmentApproval.findFirstOrThrow({
      where: { userId: plainStaffUserId, roleId: systemAdministratorRoleId, status: 'PENDING' },
    });

    const res = await request(app.getHttpServer())
      .post(`/v1/role-assignment-approvals/${approval.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('lets a different reviewer approve, which then actually grants the role', async () => {
    const secondAdmin = await prisma.user.findUniqueOrThrow({ where: { id: secondAdminId } });
    const secondAdminToken = await login(secondAdmin.email);

    const approval = await prisma.roleAssignmentApproval.findFirstOrThrow({
      where: { userId: plainStaffUserId, roleId: systemAdministratorRoleId, status: 'PENDING' },
    });

    const res = await request(app.getHttpServer())
      .post(`/v1/role-assignment-approvals/${approval.id}/approve`)
      .set('Authorization', `Bearer ${secondAdminToken}`);
    expect(res.status).toBe(200);

    const held = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: plainStaffUserId, roleId: systemAdministratorRoleId } },
    });
    expect(held).not.toBeNull();
  });

  it('writes a hash-chained audit trail — every entry links to the one immediately before it, globally', async () => {
    // The chain is global across every resource type, not a per-resource
    // sub-chain (auth-service's other actions — role grants, API keys,
    // feature flags — interleave into the same sequence) — so integrity
    // has to be checked over the *entire* ordered table, not a
    // resourceType-filtered slice, which would only be contiguous by
    // coincidence.
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < logs.length; i += 1) {
      const current = logs[i]!;
      const previous = logs[i - 1]!;
      expect(current.previousHash).toBe(previous.integrityHash);
    }

    const approvalLogs = logs.filter((l) => l.resourceType === 'ROLE_ASSIGNMENT_APPROVAL');
    expect(approvalLogs.some((l) => l.actionType === 'CREATE')).toBe(true);
    expect(approvalLogs.some((l) => l.actionType === 'APPROVE')).toBe(true);
  });
});

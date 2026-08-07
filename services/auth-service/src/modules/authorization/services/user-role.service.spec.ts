import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRoleService } from './user-role.service';
import type { PrismaService } from '@ecoswift/database';
import type { PermissionResolverPort } from '@ecoswift/authz';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { AuthorizationAuditService } from './authorization-audit.service';

describe('UserRoleService', () => {
  let prisma: {
    user: { findUnique: jest.Mock };
    role: { findUnique: jest.Mock };
    userRole: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; delete: jest.Mock };
    roleAssignmentApproval: { create: jest.Mock };
  };
  let audit: jest.Mocked<Pick<AuthorizationAuditService, 'record'>>;
  let permissionResolver: jest.Mocked<PermissionResolverPort>;
  let eventPublisher: { publish: jest.Mock };
  let service: UserRoleService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      role: { findUnique: jest.fn() },
      userRole: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
      roleAssignmentApproval: { create: jest.fn() },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    permissionResolver = { getEffectivePermissions: jest.fn().mockResolvedValue(new Set()), invalidate: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new UserRoleService(
      prisma as unknown as PrismaService,
      audit as unknown as AuthorizationAuditService,
      permissionResolver,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  describe('assign', () => {
    it('throws when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.assign('missing-user', 'role-1', 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when the role does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.assign('user-1', 'missing-role', 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects assigning a role the user already holds', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'AUDITOR', isSensitive: false });
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'user-1', roleId: 'role-1' });
      await expect(service.assign('user-1', 'role-1', 'actor-1')).rejects.toThrow(ConflictException);
    });

    it('assigns a non-sensitive role immediately', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'CUSTOMER_SUPPORT', isSensitive: false });
      prisma.userRole.findUnique.mockResolvedValue(null);

      const result = await service.assign('user-1', 'role-1', 'actor-1');

      expect(result).toEqual({ status: 'ASSIGNED', userId: 'user-1', roleId: 'role-1' });
      expect(prisma.userRole.create).toHaveBeenCalledWith({ data: { userId: 'user-1', roleId: 'role-1', assignedBy: 'actor-1' } });
      expect(prisma.roleAssignmentApproval.create).not.toHaveBeenCalled();
      expect(permissionResolver.invalidate).toHaveBeenCalledWith('user-1');
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'authorization.role_assigned_to_user' }));
    });

    it('routes a sensitive role through approval instead of assigning it directly', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'SYSTEM_ADMINISTRATOR', isSensitive: true });
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.roleAssignmentApproval.create.mockResolvedValue({ id: 'approval-1' });

      const result = await service.assign('user-1', 'role-1', 'actor-1');

      expect(result).toEqual({ status: 'PENDING_APPROVAL', approvalId: 'approval-1' });
      expect(prisma.userRole.create).not.toHaveBeenCalled();
      expect(prisma.roleAssignmentApproval.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', roleId: 'role-1', requestedBy: 'actor-1', status: 'PENDING' },
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'authorization.role_assignment_requested' }),
      );
    });
  });

  describe('revoke', () => {
    it('throws when the user does not hold the role', async () => {
      prisma.userRole.findUnique.mockResolvedValue(null);
      await expect(service.revoke('user-1', 'role-1', 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('deletes the assignment and invalidates the cached permission set', async () => {
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'user-1', roleId: 'role-1', role: { name: 'AUDITOR' } });

      await service.revoke('user-1', 'role-1', 'actor-1');

      expect(prisma.userRole.delete).toHaveBeenCalledWith({ where: { userId_roleId: { userId: 'user-1', roleId: 'role-1' } } });
      expect(permissionResolver.invalidate).toHaveBeenCalledWith('user-1');
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'authorization.role_revoked_from_user' }));
    });
  });

  describe('listForUser', () => {
    it('throws when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.listForUser('missing-user')).rejects.toThrow(NotFoundException);
    });

    it('returns held roles alongside the sorted effective permission set', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.userRole.findMany.mockResolvedValue([{ roleId: 'role-1', role: { name: 'AUDITOR' } }]);
      permissionResolver.getEffectivePermissions.mockResolvedValue(new Set(['roles:read', 'audit_logs:read']));

      const result = await service.listForUser('user-1');

      expect(result.userRoles).toHaveLength(1);
      expect(result.effectivePermissions).toEqual(['audit_logs:read', 'roles:read']);
    });
  });
});

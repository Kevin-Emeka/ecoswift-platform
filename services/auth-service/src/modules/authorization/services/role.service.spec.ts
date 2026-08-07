import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RoleService } from './role.service';
import type { PrismaService } from '@ecoswift/database';
import type { PermissionResolverPort } from '@ecoswift/authz';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { AuthorizationAuditService } from './authorization-audit.service';

describe('RoleService', () => {
  let prisma: {
    role: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock; count: jest.Mock };
    permission: { findUnique: jest.Mock };
    rolePermission: { upsert: jest.Mock; deleteMany: jest.Mock };
    userRole: { count: jest.Mock; findMany: jest.Mock };
    auditLog: { findMany: jest.Mock };
  };
  let audit: jest.Mocked<Pick<AuthorizationAuditService, 'record'>>;
  let permissionResolver: jest.Mocked<PermissionResolverPort>;
  let eventPublisher: { publish: jest.Mock };
  let service: RoleService;

  beforeEach(() => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]), // no child roles by default, for the hierarchy-invalidation walk
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      permission: { findUnique: jest.fn() },
      rolePermission: { upsert: jest.fn(), deleteMany: jest.fn() },
      userRole: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { findMany: jest.fn() },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    permissionResolver = { getEffectivePermissions: jest.fn(), invalidate: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new RoleService(
      prisma as unknown as PrismaService,
      audit as unknown as AuthorizationAuditService,
      permissionResolver,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  describe('create', () => {
    it('rejects a duplicate role name', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create({ name: 'AUDITOR' }, 'actor-1')).rejects.toThrow(ConflictException);
      expect(prisma.role.create).not.toHaveBeenCalled();
    });

    it('creates a non-system role and records an audit entry', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue({ id: 'role-1', name: 'REGIONAL_MANAGER' });

      const result = await service.create({ name: 'REGIONAL_MANAGER' }, 'actor-1');

      expect(result).toEqual({ id: 'role-1', name: 'REGIONAL_MANAGER' });
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isSystemRole: false }) }),
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'CREATE', resourceType: 'ROLE' }));
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'authorization.role_created' }));
    });

    it('validates the parent role exists before creating', async () => {
      prisma.role.findUnique.mockResolvedValueOnce(null); // name uniqueness check
      prisma.role.findUnique.mockResolvedValueOnce(null); // parent existence check
      await expect(service.create({ name: 'X', parentRoleId: 'missing-parent' }, 'actor-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update — hierarchy cycle prevention', () => {
    it('rejects a role being set as its own parent', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'X', description: null, parentRoleId: null, isSensitive: false });
      await expect(service.update('role-1', { parentRoleId: 'role-1' }, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a parent assignment that would create a cycle', async () => {
      // role-1 -> role-2 -> role-3 already; setting role-3's parent to role-1 would cycle.
      prisma.role.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        const roles: Record<string, { id: string; name: string; description: null; parentRoleId: string | null; isSensitive: boolean }> = {
          'role-1': { id: 'role-1', name: 'A', description: null, parentRoleId: null, isSensitive: false },
          'role-2': { id: 'role-2', name: 'B', description: null, parentRoleId: 'role-1', isSensitive: false },
          'role-3': { id: 'role-3', name: 'C', description: null, parentRoleId: 'role-2', isSensitive: false },
        };
        return Promise.resolve(roles[where.id] ?? null);
      });

      await expect(service.update('role-1', { parentRoleId: 'role-3' }, 'actor-1')).rejects.toThrow(
        'This would create a cycle in the role hierarchy',
      );
    });

    it('allows a valid, non-cyclic re-parenting', async () => {
      prisma.role.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        const roles: Record<string, { id: string; name: string; description: null; parentRoleId: string | null; isSensitive: boolean }> = {
          'role-1': { id: 'role-1', name: 'A', description: null, parentRoleId: null, isSensitive: false },
          'role-2': { id: 'role-2', name: 'B', description: null, parentRoleId: null, isSensitive: false },
        };
        return Promise.resolve(roles[where.id] ?? null);
      });
      prisma.role.update.mockResolvedValue({ description: null, parentRoleId: 'role-2', isSensitive: false });

      await expect(service.update('role-1', { parentRoleId: 'role-2' }, 'actor-1')).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('refuses to delete a system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'AUDITOR', isSystemRole: true });
      await expect(service.delete('role-1', 'actor-1')).rejects.toThrow(ConflictException);
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete a role still assigned to users', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'CUSTOM', isSystemRole: false });
      prisma.userRole.count.mockResolvedValue(3);
      await expect(service.delete('role-1', 'actor-1')).rejects.toThrow(ConflictException);
    });

    it('refuses to delete a role that other roles still inherit from', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'CUSTOM', isSystemRole: false });
      prisma.userRole.count.mockResolvedValue(0);
      prisma.role.count.mockResolvedValue(2);
      await expect(service.delete('role-1', 'actor-1')).rejects.toThrow(ConflictException);
    });

    it('deletes a custom, unassigned, childless role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'CUSTOM', isSystemRole: false, description: null });
      prisma.userRole.count.mockResolvedValue(0);
      prisma.role.count.mockResolvedValue(0);

      await service.delete('role-1', 'actor-1');

      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'role-1' } });
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'authorization.role_deleted' }));
    });
  });

  describe('grantPermission / revokePermission', () => {
    it('throws for an unknown permission code', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'X' });
      prisma.permission.findUnique.mockResolvedValue(null);
      await expect(service.grantPermission('role-1', 'not_a_resource', 'read', 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('grants a known permission and invalidates cached permissions for every holder', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'X' });
      prisma.permission.findUnique.mockResolvedValue({ id: 'perm-1', resource: 'accounts', action: 'read' });
      prisma.userRole.findMany.mockResolvedValue([{ userId: 'holder-1' }, { userId: 'holder-2' }]);
      prisma.role.findMany = jest.fn().mockResolvedValue([]); // no child roles for the invalidation walk

      await service.grantPermission('role-1', 'accounts', 'read', 'actor-1');

      expect(prisma.rolePermission.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: { roleId: 'role-1', permissionId: 'perm-1' } }),
      );
      expect(permissionResolver.invalidate).toHaveBeenCalledWith('holder-1');
      expect(permissionResolver.invalidate).toHaveBeenCalledWith('holder-2');
    });

    it('revokes a known permission from a role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'X' });
      prisma.permission.findUnique.mockResolvedValue({ id: 'perm-1', resource: 'accounts', action: 'freeze' });
      prisma.role.findMany = jest.fn().mockResolvedValue([]);

      await service.revokePermission('role-1', 'accounts', 'freeze', 'actor-1');

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1', permissionId: 'perm-1' } });
    });
  });
});

import { PermissionResolverService } from './permission-resolver.service';
import type { PrismaService } from '@ecoswift/database';
import type { CacheService } from '@ecoswift/cache';

describe('PermissionResolverService', () => {
  let prisma: {
    userRole: { findMany: jest.Mock };
    role: { findUnique: jest.Mock };
    rolePermission: { findMany: jest.Mock };
  };
  let cache: { wrap: jest.Mock; del: jest.Mock };
  let service: PermissionResolverService;

  beforeEach(() => {
    prisma = {
      userRole: { findMany: jest.fn() },
      role: { findUnique: jest.fn() },
      rolePermission: { findMany: jest.fn() },
    };
    // wrap() just runs the loader directly — the resolver's own hierarchy logic is what's under test, not the cache wrapper itself.
    cache = {
      wrap: jest.fn().mockImplementation((_key: string, loader: () => Promise<unknown>) => loader()),
      del: jest.fn().mockResolvedValue(undefined),
    };
    service = new PermissionResolverService(prisma as unknown as PrismaService, cache as unknown as CacheService);
  });

  it('returns an empty set for a user with no roles', async () => {
    prisma.userRole.findMany.mockResolvedValue([]);
    const result = await service.getEffectivePermissions('user-1');
    expect(result.size).toBe(0);
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
  });

  it('returns the direct permissions of a single role with no parent', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ roleId: 'role-1' }]);
    prisma.role.findUnique.mockResolvedValue({ parentRoleId: null });
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: { resource: 'accounts', action: 'read' } },
      { permission: { resource: 'accounts', action: 'freeze' } },
    ]);

    const result = await service.getEffectivePermissions('user-1');
    expect([...result].sort()).toEqual(['accounts:freeze', 'accounts:read']);
  });

  it('expands a hierarchy chain, unioning the parent role\'s permissions', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ roleId: 'child-role' }]);
    prisma.role.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'child-role') return Promise.resolve({ parentRoleId: 'parent-role' });
      if (where.id === 'parent-role') return Promise.resolve({ parentRoleId: null });
      return Promise.resolve(null);
    });
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: { resource: 'roles', action: 'read' } },
      { permission: { resource: 'users', action: 'read' } },
    ]);

    await service.getEffectivePermissions('user-1');

    // Both the child and its ancestor must be included in the lookup for role-permission rows.
    const queriedRoleIds = prisma.rolePermission.findMany.mock.calls[0][0].where.roleId.in;
    expect(new Set(queriedRoleIds)).toEqual(new Set(['child-role', 'parent-role']));
  });

  it('unions permissions across multiple roles held simultaneously', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ roleId: 'role-a' }, { roleId: 'role-b' }]);
    prisma.role.findUnique.mockResolvedValue({ parentRoleId: null });
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: { resource: 'loans', action: 'read' } },
      { permission: { resource: 'loans', action: 'approve' } },
    ]);

    const result = await service.getEffectivePermissions('user-1');
    expect([...result].sort()).toEqual(['loans:approve', 'loans:read']);
  });

  it('does not walk past a cyclic hierarchy indefinitely', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ roleId: 'role-a' }]);
    // A cycle: a -> b -> a -> b -> ...
    prisma.role.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'role-a') return Promise.resolve({ parentRoleId: 'role-b' });
      if (where.id === 'role-b') return Promise.resolve({ parentRoleId: 'role-a' });
      return Promise.resolve(null);
    });
    prisma.rolePermission.findMany.mockResolvedValue([]);

    await expect(service.getEffectivePermissions('user-1')).resolves.toBeDefined();
    // Terminates at all — the cycle guard did its job, whatever the exact bound reached.
  });

  it('invalidate() deletes the cached entry for that user', async () => {
    await service.invalidate('user-1');
    expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('user-1'));
  });
});

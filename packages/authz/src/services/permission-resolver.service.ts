import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { CacheService } from '@ecoswift/cache';
import type { PermissionResolverPort } from '../interfaces/permission-resolver.port';
import { permissionCode } from '../catalog/permission-catalog';

const CACHE_PREFIX = 'authz:permissions:';
const CACHE_TTL_SECONDS = 30;
/** Hard ceiling on hierarchy-chain depth — a defensive bound, not a design target (the seeded catalog is 2 levels deep at most). Guards against a data-entry mistake creating a very long or (structurally impossible, but defense-in-depth) cyclic chain from turning one request into an unbounded walk. */
const MAX_HIERARCHY_DEPTH = 10;

/**
 * The one real implementation of `PermissionResolverPort` — computes a
 * user's effective permission set by walking every role they hold up
 * through its hierarchy chain (docs/rbac.md § Role Hierarchy), unioning
 * every permission granted anywhere in that expanded set.
 *
 * Cached briefly (30s, same order of magnitude as `ConfigurationService`'s
 * setting cache) because this resolves on every permission-gated request —
 * without a cache, a single API call touching a permission guard would mean
 * a role/hierarchy/permission join query on every request, for a set of
 * facts that changes rarely (role assignment) compared to how often it's
 * read (every request).
 */
@Injectable()
export class PermissionResolverService implements PermissionResolverPort {
  private readonly logger = new Logger(PermissionResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const codes = await this.cache.wrap(
      `${CACHE_PREFIX}${userId}`,
      () => this.computeEffectivePermissions(userId),
      { ttlSeconds: CACHE_TTL_SECONDS },
    );
    return new Set(codes);
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`${CACHE_PREFIX}${userId}`);
  }

  private async computeEffectivePermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({ where: { userId }, select: { roleId: true } });
    if (userRoles.length === 0) return [];

    const roleIds = new Set<string>();
    for (const { roleId } of userRoles) {
      await this.expandHierarchy(roleId, roleIds, 0);
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: [...roleIds] } },
      select: { permission: { select: { resource: true, action: true } } },
    });

    const codes = new Set<string>();
    for (const { permission } of rolePermissions) {
      codes.add(permissionCode(permission.resource, permission.action));
    }
    return [...codes];
  }

  /** Adds `roleId` and every ancestor (via `parentRoleId`) to `acc`, stopping at a cycle or `MAX_HIERARCHY_DEPTH` — the hierarchy is meant to be a short chain, never a place a request can get stuck. */
  private async expandHierarchy(roleId: string, acc: Set<string>, depth: number): Promise<void> {
    if (acc.has(roleId) || depth >= MAX_HIERARCHY_DEPTH) {
      if (depth >= MAX_HIERARCHY_DEPTH) {
        this.logger.warn(`Role hierarchy depth limit reached expanding role ${roleId} — possible cycle or misconfigured chain`);
      }
      return;
    }
    acc.add(roleId);

    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { parentRoleId: true } });
    if (role?.parentRoleId) {
      await this.expandHierarchy(role.parentRoleId, acc, depth + 1);
    }
  }
}

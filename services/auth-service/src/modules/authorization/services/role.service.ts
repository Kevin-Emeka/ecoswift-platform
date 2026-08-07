import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, ROLE_CREATED, ROLE_UPDATED, ROLE_DELETED } from '@ecoswift/event-bus';
import { PERMISSION_RESOLVER, type PermissionResolverPort, permissionCode } from '@ecoswift/authz';
import { AuthorizationAuditService } from './authorization-audit.service';

export interface CreateRoleInput {
  name: string;
  description?: string;
  parentRoleId?: string;
  isSensitive?: boolean;
}

export interface UpdateRoleInput {
  description?: string;
  parentRoleId?: string | null;
  isSensitive?: boolean;
}

const MAX_HIERARCHY_DEPTH = 10;

/**
 * Role CRUD and hierarchy management (docs/rbac.md). A role's `name` is
 * immutable once created — renaming would silently break `prisma/seed.ts`'s
 * upsert-by-name idempotency for the seeded catalog and is treated as
 * "create a new role and migrate assignments," not a field edit.
 */
@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuthorizationAuditService,
    @Inject(PERMISSION_RESOLVER) private readonly permissionResolver: PermissionResolverPort,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async list() {
    return this.prisma.role.findMany({
      include: { parentRole: { select: { id: true, name: true } }, _count: { select: { rolePermissions: true, userRoles: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        parentRole: { select: { id: true, name: true } },
        childRoles: { select: { id: true, name: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(input: CreateRoleInput, actorUserId: string): Promise<{ id: string; name: string }> {
    const existing = await this.prisma.role.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ConflictException(`A role named "${input.name}" already exists`);
    }
    if (input.parentRoleId) {
      await this.assertRoleExists(input.parentRoleId);
    }

    const role = await this.prisma.role.create({
      data: {
        name: input.name,
        description: input.description,
        parentRoleId: input.parentRoleId,
        isSensitive: input.isSensitive ?? false,
        isSystemRole: false,
      },
    });

    await this.audit.record({
      actorUserId,
      actionType: 'CREATE',
      resourceType: 'ROLE',
      resourceId: role.id,
      description: `Role "${role.name}" created`,
      afterState: { name: role.name, description: role.description, parentRoleId: role.parentRoleId, isSensitive: role.isSensitive },
    });
    await this.eventPublisher.publish({
      eventType: ROLE_CREATED,
      producerContext: 'auth-service',
      payload: { roleId: role.id, name: role.name, createdBy: actorUserId },
    });

    return { id: role.id, name: role.name };
  }

  async update(id: string, input: UpdateRoleInput, actorUserId: string): Promise<void> {
    const role = await this.assertRoleExists(id);

    if (input.parentRoleId !== undefined && input.parentRoleId !== null) {
      if (input.parentRoleId === id) {
        throw new BadRequestException('A role cannot be its own parent');
      }
      await this.assertRoleExists(input.parentRoleId);
      await this.assertNoCycle(id, input.parentRoleId);
    }

    const before = { description: role.description, parentRoleId: role.parentRoleId, isSensitive: role.isSensitive };

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        description: input.description ?? undefined,
        parentRoleId: input.parentRoleId === undefined ? undefined : input.parentRoleId,
        isSensitive: input.isSensitive ?? undefined,
      },
    });

    await this.invalidateAllHoldersOf(id);

    await this.audit.record({
      actorUserId,
      actionType: 'UPDATE',
      resourceType: 'ROLE',
      resourceId: id,
      description: `Role "${role.name}" updated`,
      beforeState: before,
      afterState: { description: updated.description, parentRoleId: updated.parentRoleId, isSensitive: updated.isSensitive },
    });
    await this.eventPublisher.publish({
      eventType: ROLE_UPDATED,
      producerContext: 'auth-service',
      payload: { roleId: id, name: role.name, updatedBy: actorUserId },
    });
  }

  async delete(id: string, actorUserId: string): Promise<void> {
    const role = await this.assertRoleExists(id);
    if (role.isSystemRole) {
      throw new ConflictException(`"${role.name}" is a system role and cannot be deleted`);
    }

    const [assignmentCount, childCount] = await Promise.all([
      this.prisma.userRole.count({ where: { roleId: id } }),
      this.prisma.role.count({ where: { parentRoleId: id } }),
    ]);
    if (assignmentCount > 0) {
      throw new ConflictException(`Cannot delete "${role.name}" — it is still assigned to ${assignmentCount} user(s)`);
    }
    if (childCount > 0) {
      throw new ConflictException(`Cannot delete "${role.name}" — ${childCount} role(s) still inherit from it`);
    }

    await this.prisma.role.delete({ where: { id } });

    await this.audit.record({
      actorUserId,
      actionType: 'DELETE',
      resourceType: 'ROLE',
      resourceId: id,
      description: `Role "${role.name}" deleted`,
      beforeState: { name: role.name, description: role.description },
    });
    await this.eventPublisher.publish({
      eventType: ROLE_DELETED,
      producerContext: 'auth-service',
      payload: { roleId: id, name: role.name, deletedBy: actorUserId },
    });
  }

  async grantPermission(roleId: string, resource: string, action: string, actorUserId: string): Promise<void> {
    const role = await this.assertRoleExists(roleId);
    const permission = await this.prisma.permission.findUnique({ where: { resource_action: { resource, action } } });
    if (!permission) throw new NotFoundException(`Unknown permission "${permissionCode(resource, action)}"`);

    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
      update: {},
      create: { roleId, permissionId: permission.id },
    });

    await this.invalidateAllHoldersOf(roleId);

    await this.audit.record({
      actorUserId,
      actionType: 'UPDATE',
      resourceType: 'ROLE',
      resourceId: roleId,
      description: `Permission "${permissionCode(resource, action)}" granted to role "${role.name}"`,
      afterState: { grantedPermission: permissionCode(resource, action) },
    });
  }

  async revokePermission(roleId: string, resource: string, action: string, actorUserId: string): Promise<void> {
    const role = await this.assertRoleExists(roleId);
    const permission = await this.prisma.permission.findUnique({ where: { resource_action: { resource, action } } });
    if (!permission) throw new NotFoundException(`Unknown permission "${permissionCode(resource, action)}"`);

    await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId: permission.id } });

    await this.invalidateAllHoldersOf(roleId);

    await this.audit.record({
      actorUserId,
      actionType: 'UPDATE',
      resourceType: 'ROLE',
      resourceId: roleId,
      description: `Permission "${permissionCode(resource, action)}" revoked from role "${role.name}"`,
      beforeState: { revokedPermission: permissionCode(resource, action) },
    });
  }

  async auditHistory(roleId: string) {
    await this.assertRoleExists(roleId);
    return this.prisma.auditLog.findMany({
      where: { resourceType: 'ROLE', resourceId: roleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertRoleExists(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  /** Walks up from `candidateParentId` — if `roleId` is found among its ancestors, setting that parent on `roleId` would create a cycle. */
  private async assertNoCycle(roleId: string, candidateParentId: string): Promise<void> {
    let currentId: string | null = candidateParentId;
    for (let depth = 0; currentId && depth < MAX_HIERARCHY_DEPTH; depth += 1) {
      if (currentId === roleId) {
        throw new BadRequestException('This would create a cycle in the role hierarchy');
      }
      const current: { parentRoleId: string | null } | null = await this.prisma.role.findUnique({
        where: { id: currentId },
        select: { parentRoleId: true },
      });
      currentId = current?.parentRoleId ?? null;
    }
  }

  /**
   * A role change (permission grant/revoke, re-parenting) affects every
   * user who holds *this* role **or any role descended from it** — a child
   * role's effective permissions include everything its parent grants, so
   * a parent-side change must invalidate descendants' holders too, not
   * just this role's own direct holders.
   */
  private async invalidateAllHoldersOf(roleId: string): Promise<void> {
    const affectedRoleIds = await this.collectDescendants(roleId, 0);
    const holders = await this.prisma.userRole.findMany({
      where: { roleId: { in: [...affectedRoleIds] } },
      select: { userId: true },
    });
    await Promise.all([...new Set(holders.map((h) => h.userId))].map((userId) => this.permissionResolver.invalidate(userId)));
  }

  private async collectDescendants(roleId: string, depth: number): Promise<Set<string>> {
    const acc = new Set<string>([roleId]);
    if (depth >= MAX_HIERARCHY_DEPTH) return acc;
    const children = await this.prisma.role.findMany({ where: { parentRoleId: roleId }, select: { id: true } });
    for (const child of children) {
      const childDescendants = await this.collectDescendants(child.id, depth + 1);
      for (const id of childDescendants) acc.add(id);
    }
    return acc;
  }
}

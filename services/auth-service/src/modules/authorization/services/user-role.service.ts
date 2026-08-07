import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import {
  EVENT_PUBLISHER,
  ROLE_ASSIGNED_TO_USER,
  ROLE_ASSIGNMENT_REQUESTED,
  ROLE_REVOKED_FROM_USER,
} from '@ecoswift/event-bus';
import { PERMISSION_RESOLVER, type PermissionResolverPort } from '@ecoswift/authz';
import { AuthorizationAuditService } from './authorization-audit.service';

export type AssignRoleResult = { status: 'ASSIGNED'; userId: string; roleId: string } | { status: 'PENDING_APPROVAL'; approvalId: string };

/**
 * Assigns/revokes roles to/from users. This is where "Delegated
 * Administration" actually lives (docs/rbac.md § Delegated Administration):
 * anyone holding `roles:assign` can assign a *non-sensitive* role
 * immediately — day-to-day role administration doesn't need to escalate to
 * a Super Administrator. A **sensitive** role (`Role.isSensitive`, seeded
 * true for System Administrator and Super Administrator) never gets
 * assigned directly here, no matter who's asking — it always routes
 * through `RoleAssignmentApprovalService`'s maker-checker gate instead.
 */
@Injectable()
export class UserRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuthorizationAuditService,
    @Inject(PERMISSION_RESOLVER) private readonly permissionResolver: PermissionResolverPort,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async listForUser(userId: string) {
    await this.assertUserExists(userId);
    const [userRoles, effectivePermissions] = await Promise.all([
      this.prisma.userRole.findMany({ where: { userId }, include: { role: true } }),
      this.permissionResolver.getEffectivePermissions(userId),
    ]);
    return { userRoles, effectivePermissions: [...effectivePermissions].sort() };
  }

  async assign(targetUserId: string, roleId: string, actorUserId: string): Promise<AssignRoleResult> {
    await this.assertUserExists(targetUserId);
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.prisma.userRole.findUnique({ where: { userId_roleId: { userId: targetUserId, roleId } } });
    if (existing) {
      throw new ConflictException(`User already holds the "${role.name}" role`);
    }

    if (role.isSensitive) {
      const approval = await this.prisma.roleAssignmentApproval.create({
        data: { userId: targetUserId, roleId, requestedBy: actorUserId, status: 'PENDING' },
      });

      await this.audit.record({
        actorUserId,
        actionType: 'CREATE',
        resourceType: 'ROLE_ASSIGNMENT_APPROVAL',
        resourceId: approval.id,
        description: `Requested assignment of sensitive role "${role.name}" to user ${targetUserId} — pending approval`,
        afterState: { userId: targetUserId, roleId, roleName: role.name },
      });
      await this.eventPublisher.publish({
        eventType: ROLE_ASSIGNMENT_REQUESTED,
        producerContext: 'auth-service',
        payload: { approvalId: approval.id, userId: targetUserId, roleId, roleName: role.name, requestedBy: actorUserId },
      });

      return { status: 'PENDING_APPROVAL', approvalId: approval.id };
    }

    await this.prisma.userRole.create({ data: { userId: targetUserId, roleId, assignedBy: actorUserId } });
    await this.permissionResolver.invalidate(targetUserId);

    await this.audit.record({
      actorUserId,
      actionType: 'CREATE',
      resourceType: 'USER_ROLE',
      resourceId: `${targetUserId}:${roleId}`,
      description: `Role "${role.name}" assigned to user ${targetUserId}`,
      afterState: { userId: targetUserId, roleId, roleName: role.name },
    });
    await this.eventPublisher.publish({
      eventType: ROLE_ASSIGNED_TO_USER,
      producerContext: 'auth-service',
      payload: { userId: targetUserId, roleId, roleName: role.name, assignedBy: actorUserId },
    });

    return { status: 'ASSIGNED', userId: targetUserId, roleId };
  }

  async revoke(targetUserId: string, roleId: string, actorUserId: string): Promise<void> {
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId: targetUserId, roleId } },
      include: { role: true },
    });
    if (!existing) throw new NotFoundException('User does not hold this role');

    await this.prisma.userRole.delete({ where: { userId_roleId: { userId: targetUserId, roleId } } });
    await this.permissionResolver.invalidate(targetUserId);

    await this.audit.record({
      actorUserId,
      actionType: 'DELETE',
      resourceType: 'USER_ROLE',
      resourceId: `${targetUserId}:${roleId}`,
      description: `Role "${existing.role.name}" revoked from user ${targetUserId}`,
      beforeState: { userId: targetUserId, roleId, roleName: existing.role.name },
    });
    await this.eventPublisher.publish({
      eventType: ROLE_REVOKED_FROM_USER,
      producerContext: 'auth-service',
      payload: { userId: targetUserId, roleId, roleName: existing.role.name, revokedBy: actorUserId },
    });
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }
}

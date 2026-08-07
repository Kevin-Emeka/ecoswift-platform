import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, ROLE_ASSIGNMENT_APPROVED, ROLE_ASSIGNMENT_REJECTED } from '@ecoswift/event-bus';
import { PERMISSION_RESOLVER, type PermissionResolverPort } from '@ecoswift/authz';
import { AuthorizationAuditService } from './authorization-audit.service';

/**
 * Maker-checker gate for sensitive role assignments
 * (docs/compliance-controls.md § Administrative Approval Hooks). The one
 * rule enforced structurally, not just by convention: **the reviewer can
 * never be the same person as the requester** — approving or rejecting
 * your own request is rejected outright regardless of what permissions you
 * hold, including Super Administrator.
 */
@Injectable()
export class RoleAssignmentApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuthorizationAuditService,
    @Inject(PERMISSION_RESOLVER) private readonly permissionResolver: PermissionResolverPort,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async listPending() {
    return this.prisma.roleAssignmentApproval.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, email: true } }, role: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(approvalId: string, actorUserId: string): Promise<void> {
    const approval = await this.getPendingOrThrow(approvalId);
    this.assertMakerNotChecker(approval.requestedBy, actorUserId);

    const alreadyHeld = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId: approval.userId, roleId: approval.roleId } },
    });
    if (alreadyHeld) {
      throw new ConflictException('User already holds this role — nothing to approve');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.create({ data: { userId: approval.userId, roleId: approval.roleId, assignedBy: actorUserId } }),
      this.prisma.roleAssignmentApproval.update({
        where: { id: approvalId },
        data: { status: 'APPROVED', reviewedBy: actorUserId, reviewedAt: new Date() },
      }),
    ]);
    await this.permissionResolver.invalidate(approval.userId);

    await this.audit.record({
      actorUserId,
      actionType: 'APPROVE',
      resourceType: 'ROLE_ASSIGNMENT_APPROVAL',
      resourceId: approvalId,
      description: `Approved assignment of "${approval.role.name}" to user ${approval.userId}`,
      afterState: { userId: approval.userId, roleId: approval.roleId, roleName: approval.role.name, requestedBy: approval.requestedBy },
    });
    await this.eventPublisher.publish({
      eventType: ROLE_ASSIGNMENT_APPROVED,
      producerContext: 'auth-service',
      payload: { approvalId, userId: approval.userId, roleId: approval.roleId, roleName: approval.role.name, reviewedBy: actorUserId },
    });
  }

  async reject(approvalId: string, actorUserId: string, reviewNote?: string): Promise<void> {
    const approval = await this.getPendingOrThrow(approvalId);
    this.assertMakerNotChecker(approval.requestedBy, actorUserId);

    await this.prisma.roleAssignmentApproval.update({
      where: { id: approvalId },
      data: { status: 'REJECTED', reviewedBy: actorUserId, reviewedAt: new Date(), reviewNote },
    });

    await this.audit.record({
      actorUserId,
      actionType: 'REJECT',
      resourceType: 'ROLE_ASSIGNMENT_APPROVAL',
      resourceId: approvalId,
      description: `Rejected assignment of "${approval.role.name}" to user ${approval.userId}`,
      afterState: { userId: approval.userId, roleId: approval.roleId, roleName: approval.role.name, reviewNote },
    });
    await this.eventPublisher.publish({
      eventType: ROLE_ASSIGNMENT_REJECTED,
      producerContext: 'auth-service',
      payload: { approvalId, userId: approval.userId, roleId: approval.roleId, roleName: approval.role.name, reviewedBy: actorUserId, reviewNote },
    });
  }

  private async getPendingOrThrow(approvalId: string) {
    const approval = await this.prisma.roleAssignmentApproval.findUnique({
      where: { id: approvalId },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!approval) throw new NotFoundException('Approval request not found');
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`This approval request has already been ${approval.status.toLowerCase()}`);
    }
    return approval;
  }

  private assertMakerNotChecker(requestedBy: string, actorUserId: string): void {
    if (requestedBy === actorUserId) {
      throw new ForbiddenException('You cannot review a role assignment you requested yourself');
    }
  }
}

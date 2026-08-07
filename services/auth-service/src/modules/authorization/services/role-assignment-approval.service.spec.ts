import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleAssignmentApprovalService } from './role-assignment-approval.service';
import type { PrismaService } from '@ecoswift/database';
import type { PermissionResolverPort } from '@ecoswift/authz';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import type { AuthorizationAuditService } from './authorization-audit.service';

describe('RoleAssignmentApprovalService', () => {
  let prisma: {
    roleAssignmentApproval: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    userRole: { findUnique: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let audit: jest.Mocked<Pick<AuthorizationAuditService, 'record'>>;
  let permissionResolver: jest.Mocked<PermissionResolverPort>;
  let eventPublisher: { publish: jest.Mock };
  let service: RoleAssignmentApprovalService;

  const pendingApproval = {
    id: 'approval-1',
    userId: 'target-user',
    roleId: 'role-1',
    requestedBy: 'maker-1',
    status: 'PENDING' as const,
    role: { id: 'role-1', name: 'SYSTEM_ADMINISTRATOR' },
  };

  beforeEach(() => {
    prisma = {
      roleAssignmentApproval: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      userRole: { findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    permissionResolver = { getEffectivePermissions: jest.fn(), invalidate: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new RoleAssignmentApprovalService(
      prisma as unknown as PrismaService,
      audit as unknown as AuthorizationAuditService,
      permissionResolver,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  describe('approve', () => {
    it('throws NotFoundException for an unknown approval id', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue(null);
      await expect(service.approve('missing', 'checker-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an already-decided approval', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue({ ...pendingApproval, status: 'APPROVED' });
      await expect(service.approve('approval-1', 'checker-1')).rejects.toThrow(BadRequestException);
    });

    it('structurally forbids the requester from approving their own request — maker cannot be checker', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue(pendingApproval);
      await expect(service.approve('approval-1', 'maker-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects approving when the user already somehow holds the role', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue(pendingApproval);
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'target-user', roleId: 'role-1' });
      await expect(service.approve('approval-1', 'checker-1')).rejects.toThrow(ConflictException);
    });

    it('creates the UserRole and marks the approval APPROVED, by a different actor than the requester', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue(pendingApproval);
      prisma.userRole.findUnique.mockResolvedValue(null);

      await service.approve('approval-1', 'checker-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(permissionResolver.invalidate).toHaveBeenCalledWith('target-user');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'authorization.role_assignment_approved' }),
      );
    });
  });

  describe('reject', () => {
    it('also forbids the requester from rejecting their own request', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue(pendingApproval);
      await expect(service.reject('approval-1', 'maker-1')).rejects.toThrow(ForbiddenException);
    });

    it('marks the approval REJECTED without creating any UserRole', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue(pendingApproval);

      await service.reject('approval-1', 'checker-1', 'Not appropriate for this account');

      expect(prisma.userRole.create).not.toHaveBeenCalled();
      expect(prisma.roleAssignmentApproval.update).toHaveBeenCalledWith({
        where: { id: 'approval-1' },
        data: { status: 'REJECTED', reviewedBy: 'checker-1', reviewedAt: expect.any(Date), reviewNote: 'Not appropriate for this account' },
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'authorization.role_assignment_rejected' }),
      );
    });

    it('throws for an already-decided approval', async () => {
      prisma.roleAssignmentApproval.findUnique.mockResolvedValue({ ...pendingApproval, status: 'REJECTED' });
      await expect(service.reject('approval-1', 'checker-1')).rejects.toThrow(BadRequestException);
    });
  });
});

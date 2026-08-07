import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountStatusService } from './account-status.service';
import type { PrismaService } from '@ecoswift/database';
import type { AuditService } from '../../../common/services/audit.service';
import type { EventPublisherPort } from '@ecoswift/event-bus';

describe('AccountStatusService', () => {
  let prisma: { account: { findUnique: jest.Mock; update: jest.Mock } };
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;
  let eventPublisher: { publish: jest.Mock };
  let service: AccountStatusService;

  beforeEach(() => {
    prisma = { account: { findUnique: jest.fn(), update: jest.fn() } };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new AccountStatusService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  const actor = { userId: 'user-1', actorType: 'CUSTOMER' as const };

  it('rejects an unknown target status before touching the database', async () => {
    await expect(service.transition('acc-1', 'DELETED', actor)).rejects.toThrow(BadRequestException);
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it('404s when the account does not exist', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    await expect(service.transition('missing', 'ACTIVE', actor)).rejects.toThrow(NotFoundException);
  });

  it.each([
    ['PENDING_ACTIVATION', 'ACTIVE'],
    ['PENDING_ACTIVATION', 'CLOSED'],
    ['ACTIVE', 'FROZEN'],
    ['ACTIVE', 'DORMANT'],
    ['ACTIVE', 'RESTRICTED'],
    ['ACTIVE', 'CLOSED'],
    ['FROZEN', 'ACTIVE'],
    ['FROZEN', 'CLOSED'],
    ['DORMANT', 'ACTIVE'],
    ['RESTRICTED', 'ACTIVE'],
  ])('allows %s -> %s', async (from, to) => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc-1', status: from, closedAt: null });
    prisma.account.update.mockResolvedValue({ id: 'acc-1', status: to });

    const result = await service.transition('acc-1', to, actor);
    expect(result.status).toBe(to);
  });

  it.each([
    ['CLOSED', 'ACTIVE'],
    ['ACTIVE', 'PENDING_ACTIVATION'],
    ['FROZEN', 'DORMANT'],
    ['DORMANT', 'FROZEN'],
    ['RESTRICTED', 'FROZEN'],
  ])('rejects the illegal transition %s -> %s', async (from, to) => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc-1', status: from, closedAt: null });
    await expect(service.transition('acc-1', to, actor)).rejects.toThrow(BadRequestException);
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it('sets closedAt when transitioning to CLOSED', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc-1', status: 'ACTIVE', closedAt: null });
    prisma.account.update.mockResolvedValue({ id: 'acc-1', status: 'CLOSED' });

    await service.transition('acc-1', 'CLOSED', actor, 'customer requested closure');

    expect(prisma.account.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED', closedAt: expect.any(Date) }) }),
    );
  });

  it('records an audit entry and publishes ACCOUNT_STATUS_CHANGED on every transition', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc-1', status: 'ACTIVE', closedAt: null });
    prisma.account.update.mockResolvedValue({ id: 'acc-1', status: 'FROZEN' });

    await service.transition('acc-1', 'FROZEN', actor, 'suspicious activity');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'FREEZE', resourceType: 'Account', resourceId: 'acc-1', description: 'suspicious activity' }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'account.status_changed', payload: expect.objectContaining({ previousStatus: 'ACTIVE', newStatus: 'FROZEN' }) }),
    );
  });
});

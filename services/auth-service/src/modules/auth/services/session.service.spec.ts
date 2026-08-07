import { SessionService } from './session.service';
import type { PrismaService } from '@ecoswift/database';
import type { ConfigurationService } from '@ecoswift/config';
import type { EventPublisherPort } from '@ecoswift/event-bus';

describe('SessionService', () => {
  let prisma: {
    session: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let configurationService: { getNumber: jest.Mock };
  let eventPublisher: { publish: jest.Mock };
  let service: SessionService;

  beforeEach(() => {
    prisma = {
      session: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };
    configurationService = { getNumber: jest.fn().mockResolvedValue(5) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new SessionService(
      prisma as unknown as PrismaService,
      configurationService as unknown as ConfigurationService,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  describe('createSession', () => {
    it('creates the session row and publishes SESSION_CREATED', async () => {
      prisma.session.create.mockResolvedValue({ id: 'session-1', userId: 'user-1' });

      const session = await service.createSession({
        userId: 'user-1',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 1000),
      });

      expect(session.id).toBe('session-1');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.session_created' }),
      );
    });

    it('evicts the oldest active session once the concurrent limit would be exceeded', async () => {
      configurationService.getNumber.mockResolvedValue(2);
      prisma.session.findMany.mockResolvedValue([{ id: 'oldest' }, { id: 'newer' }]);
      prisma.session.findUnique.mockResolvedValue({ id: 'oldest', userId: 'user-1', status: 'ACTIVE' });
      prisma.session.create.mockResolvedValue({ id: 'session-3', userId: 'user-1' });

      await service.createSession({ userId: 'user-1', ipAddress: '127.0.0.1', expiresAt: new Date() });

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'oldest' },
        data: { status: 'REVOKED', revokedAt: expect.any(Date), revokedReason: 'CONCURRENT_SESSION_LIMIT_EXCEEDED' },
      });
      expect(prisma.session.update).toHaveBeenCalledTimes(1);
    });

    it('does not evict anything when under the concurrent limit', async () => {
      configurationService.getNumber.mockResolvedValue(5);
      prisma.session.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      prisma.session.create.mockResolvedValue({ id: 'session-3', userId: 'user-1' });

      await service.createSession({ userId: 'user-1', ipAddress: '127.0.0.1', expiresAt: new Date() });

      expect(prisma.session.update).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('marks the session REVOKED and publishes SESSION_REVOKED', async () => {
      prisma.session.findUnique.mockResolvedValue({ id: 'session-1', userId: 'user-1', status: 'ACTIVE' });

      await service.revoke('session-1', 'USER_LOGOUT');

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { status: 'REVOKED', revokedAt: expect.any(Date), revokedReason: 'USER_LOGOUT' },
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'identity.session_revoked' }),
      );
    });

    it('is a no-op for a session that no longer exists', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      await service.revoke('missing', 'USER_LOGOUT');
      expect(prisma.session.update).not.toHaveBeenCalled();
    });

    it('is a no-op for a session that is already revoked', async () => {
      prisma.session.findUnique.mockResolvedValue({ id: 'session-1', userId: 'user-1', status: 'REVOKED' });
      await service.revoke('session-1', 'USER_LOGOUT');
      expect(prisma.session.update).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllForUser', () => {
    it('revokes every active session except the one excluded', async () => {
      prisma.session.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      prisma.session.findUnique.mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve({ id: args.where.id, userId: 'user-1', status: 'ACTIVE' }),
      );

      await service.revokeAllForUser('user-1', 'PASSWORD_CHANGED', 'current-session');

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE', id: { not: 'current-session' } },
        select: { id: true },
      });
      expect(prisma.session.update).toHaveBeenCalledTimes(2);
    });
  });
});

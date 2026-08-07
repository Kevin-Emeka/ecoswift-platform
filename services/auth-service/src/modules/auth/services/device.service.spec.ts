import { DeviceService } from './device.service';
import type { PrismaService } from '@ecoswift/database';
import type { SessionService } from './session.service';
import type { SecurityEventService } from '../../security/services/security-event.service';
import type { FraudHooksPort } from '@ecoswift/security';
import type { EventPublisherPort } from '@ecoswift/event-bus';

describe('DeviceService', () => {
  let prisma: {
    device: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock; findMany: jest.Mock; deleteMany: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
    session: { findMany: jest.Mock };
  };
  let sessionService: jest.Mocked<Pick<SessionService, 'revoke'>>;
  let securityEvents: jest.Mocked<Pick<SecurityEventService, 'record'>>;
  let fraudHooks: jest.Mocked<Pick<FraudHooksPort, 'evaluateNewDevice'>>;
  let eventPublisher: { publish: jest.Mock };
  let service: DeviceService;

  const context = { userAgent: 'jest-agent/1.0', ipAddress: '127.0.0.1' };

  beforeEach(() => {
    prisma = {
      device: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      session: { findMany: jest.fn().mockResolvedValue([]) },
    };
    sessionService = { revoke: jest.fn().mockResolvedValue(undefined) };
    securityEvents = { record: jest.fn().mockResolvedValue(undefined) };
    fraudHooks = {
      evaluateNewDevice: jest.fn().mockResolvedValue({ signalType: 'NEW_DEVICE', triggered: false, score: 0 }),
    };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

    service = new DeviceService(
      prisma as unknown as PrismaService,
      sessionService as unknown as SessionService,
      securityEvents as unknown as SecurityEventService,
      fraudHooks as unknown as FraudHooksPort,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  describe('recognize', () => {
    it('updates lastSeenAt and lastIpAddress for a recognized device, without calling the fraud hook', async () => {
      prisma.device.findUnique.mockResolvedValue({ id: 'device-1', deviceName: 'Old Name', trustLevel: 'UNTRUSTED' });

      const result = await service.recognize('user-1', context);

      expect(result.isNewDevice).toBe(false);
      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        data: { lastSeenAt: expect.any(Date), lastIpAddress: '127.0.0.1' },
      });
      expect(fraudHooks.evaluateNewDevice).not.toHaveBeenCalled();
    });

    it('creates a new device, calls the new-device fraud hook, and records DEVICE_REGISTERED', async () => {
      prisma.device.findUnique.mockResolvedValue(null);
      prisma.device.create.mockResolvedValue({ id: 'device-2' });
      fraudHooks.evaluateNewDevice.mockResolvedValue({ signalType: 'NEW_DEVICE', triggered: false, score: 0.1, metadata: { note: 'x' } });

      const result = await service.recognize('user-1', context);

      expect(result.isNewDevice).toBe(true);
      expect(fraudHooks.evaluateNewDevice).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', ipAddress: '127.0.0.1', deviceId: 'device-2', isNewDevice: true }),
      );
      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'device-2' }, data: expect.objectContaining({ riskScore: 0.1 }) }),
      );
      expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'DEVICE_REGISTERED' }));
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'security.device_registered' }));
    });
  });

  describe('revoke', () => {
    it('is a no-op when the device does not belong to the user', async () => {
      prisma.device.findFirst.mockResolvedValue(null);
      await service.revoke('user-1', 'device-1', 'suspicious');
      expect(prisma.device.update).not.toHaveBeenCalled();
      expect(sessionService.revoke).not.toHaveBeenCalled();
    });

    it('marks the device revoked and ends every active session tied to it', async () => {
      prisma.device.findFirst.mockResolvedValue({ id: 'device-1', userId: 'user-1' });
      prisma.session.findMany.mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);

      await service.revoke('user-1', 'device-1', 'lost phone');

      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'device-1' },
          data: expect.objectContaining({ revokedReason: 'lost phone', trustLevel: 'UNTRUSTED' }),
        }),
      );
      expect(sessionService.revoke).toHaveBeenCalledWith('session-1', 'DEVICE_REVOKED:lost phone');
      expect(sessionService.revoke).toHaveBeenCalledWith('session-2', 'DEVICE_REVOKED:lost phone');
      expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'DEVICE_REVOKED', metadata: expect.objectContaining({ sessionsRevoked: 2 }) }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'security.device_revoked' }));
    });

    it('does not touch sessions belonging to other devices', async () => {
      prisma.device.findFirst.mockResolvedValue({ id: 'device-1', userId: 'user-1' });
      await service.revoke('user-1', 'device-1', 'reason');
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deviceId: 'device-1', status: 'ACTIVE' } }),
      );
    });
  });

  describe('remove', () => {
    it('deletes the device scoped to the owning user (self-service, no session kill)', async () => {
      await service.remove('user-1', 'device-1');
      expect(prisma.device.deleteMany).toHaveBeenCalledWith({ where: { id: 'device-1', userId: 'user-1' } });
      expect(sessionService.revoke).not.toHaveBeenCalled();
    });
  });

  describe('trust', () => {
    it('marks the device trusted and records DEVICE_TRUSTED', async () => {
      await service.trust('user-1', 'device-1');
      expect(prisma.device.updateMany).toHaveBeenCalledWith({
        where: { id: 'device-1', userId: 'user-1' },
        data: { trustLevel: 'TRUSTED', trustedAt: expect.any(Date) },
      });
      expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'DEVICE_TRUSTED' }));
    });
  });
});

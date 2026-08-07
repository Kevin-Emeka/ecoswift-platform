import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationCenterService } from './notification-center.service';
import type { PrismaService } from '@ecoswift/database';

describe('NotificationCenterService', () => {
  let prisma: {
    notification: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };
  let service: NotificationCenterService;

  beforeEach(() => {
    prisma = {
      notification: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new NotificationCenterService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('scopes to the caller and paginates', async () => {
      prisma.notification.count.mockResolvedValue(5);
      await service.list('user-1', { page: 2, limit: 10 });
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recipientUserId: 'user-1' }, skip: 10, take: 10 }),
      );
    });

    it('adds an unread filter when unreadOnly is set', async () => {
      await service.list('user-1', { page: 1, limit: 10, unreadOnly: true });
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recipientUserId: 'user-1', readAt: null } }),
      );
    });
  });

  describe('markRead', () => {
    it('404s when the notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('user-1', 'notif-1')).rejects.toThrow(NotFoundException);
    });

    it('403s when the notification belongs to someone else', async () => {
      prisma.notification.findUnique.mockResolvedValue({ recipientUserId: 'someone-else' });
      await expect(service.markRead('user-1', 'notif-1')).rejects.toThrow(ForbiddenException);
    });

    it('marks the notification read and does not clobber an already-set readAt', async () => {
      const existingReadAt = new Date('2026-01-01');
      prisma.notification.findUnique.mockResolvedValue({ recipientUserId: 'user-1', readAt: existingReadAt, status: 'SENT' });
      prisma.notification.update.mockResolvedValue({
        id: 'notif-1',
        channel: 'EMAIL',
        priority: 'NORMAL',
        status: 'READ',
        renderedSubject: 'Hi',
        renderedBody: 'Body',
        createdAt: new Date(),
        readAt: existingReadAt,
      });

      await service.markRead('user-1', 'notif-1');
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ readAt: existingReadAt }) }),
      );
    });
  });

  describe('markAllRead', () => {
    it('updates every unread notification for the caller', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });
      const result = await service.markAllRead('user-1');
      expect(result.updated).toBe(4);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recipientUserId: 'user-1', readAt: null } }),
      );
    });
  });
});

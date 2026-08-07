import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { PaginatedResult } from '@ecoswift/types';
import type { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import type { NotificationResponseDto } from '../dto/notification-response.dto';

/**
 * The Notification Center backend (Milestone 1's "CUSTOMER PORTAL" brief).
 * Reads the same `Notification` table every service's own
 * `*NotificationService` already writes to when it enqueues a job
 * (`auth-service`'s `AuthNotificationService`, `account-service`'s
 * `AccountNotificationService`) — this service doesn't produce
 * notifications, it lets the recipient browse and acknowledge the ones
 * already created for them.
 */
@Injectable()
export class NotificationCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListNotificationsQueryDto): Promise<PaginatedResult<NotificationResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { recipientUserId: userId, ...(query.unreadOnly ? { readAt: null } : {}) };

    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      items: notifications.map(this.toResponseDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { recipientUserId: userId, readAt: null } });
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.recipientUserId !== userId) {
      throw new ForbiddenException('You do not have access to this resource');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date(), status: notification.status === 'FAILED' ? notification.status : 'READ' },
    });
    return this.toResponseDto(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientUserId: userId, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    return { updated: result.count };
  }

  private toResponseDto(notification: {
    id: string;
    channel: string;
    priority: string;
    status: string;
    renderedSubject: string | null;
    renderedBody: string | null;
    createdAt: Date;
    readAt: Date | null;
  }): NotificationResponseDto {
    return {
      id: notification.id,
      channel: notification.channel,
      priority: notification.priority,
      status: notification.status,
      subject: notification.renderedSubject ?? undefined,
      body: notification.renderedBody ?? undefined,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString(),
    };
  }
}

import type { DomainEvent } from '../domain-event.base';

export const NOTIFICATION_QUEUED = 'notification.queued' as const;
export interface NotificationQueuedPayload {
  notificationId: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  templateCode: string;
  recipientUserId?: string;
  recipientCustomerId?: string;
}
export type NotificationQueuedEvent = DomainEvent<typeof NOTIFICATION_QUEUED, NotificationQueuedPayload>;

export const NOTIFICATION_SENT = 'notification.sent' as const;
export interface NotificationSentPayload {
  notificationId: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  sentAt: string;
}
export type NotificationSentEvent = DomainEvent<typeof NOTIFICATION_SENT, NotificationSentPayload>;

import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface NotificationItem {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  priority: string;
  status: string;
  subject?: string;
  body?: string;
  createdAt: string;
  readAt?: string;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const NOTIFICATION = API_URLS.notification;

export function listMyNotifications(accessToken: string, page = 1, limit = 20) {
  return apiRequest<PaginatedNotifications>(NOTIFICATION, `/v1/notifications?page=${page}&limit=${limit}`, { accessToken });
}

export function getUnreadCount(accessToken: string) {
  return apiRequest<{ count: number }>(NOTIFICATION, '/v1/notifications/unread-count', { accessToken });
}

export function markNotificationRead(accessToken: string, notificationId: string) {
  return apiRequest<NotificationItem>(NOTIFICATION, `/v1/notifications/${notificationId}/read`, { method: 'PATCH', accessToken });
}

export function markAllNotificationsRead(accessToken: string) {
  return apiRequest<{ updated: number }>(NOTIFICATION, '/v1/notifications/read-all', { method: 'PATCH', accessToken });
}

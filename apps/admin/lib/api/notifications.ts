import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const NOTIFICATION = API_URLS.notification;

export interface NotificationTemplate {
  id: string;
  code: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  subjectTemplate?: string;
  locale: string;
  isActive: boolean;
  updatedAt: string;
}

/**
 * Read-only catalog view — no template-editing endpoint exists on the
 * backend yet, so this app only lists templates. Editing is future scope.
 */
export function listNotificationTemplates(accessToken: string) {
  return apiRequest<NotificationTemplate[]>(NOTIFICATION, '/v1/notification-templates', { accessToken });
}

import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const AUTH = API_URLS.auth;

export interface SessionRecord {
  id: string;
  ipAddress: string;
  userAgent?: string;
  deviceName?: string;
  issuedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/** Staff-only — view any user's active sessions by their userId (Session Viewer). Requires `users:read`. */
export function listSessionsForUser(accessToken: string, userId: string) {
  return apiRequest<SessionRecord[]>(AUTH, `/v1/sessions/user/${userId}`, { accessToken });
}

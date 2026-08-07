import { apiRequest } from './http-client';
import { API_URLS } from '../config';
import type { PaginatedResult } from '@ecoswift/types';

const AUTH = API_URLS.auth;

export interface SecurityEvent {
  id: string;
  userId?: string;
  userEmail?: string;
  eventType: string;
  deviceId?: string;
  ipAddress?: string;
  riskScore?: string;
  metadata?: unknown;
  createdAt: string;
}

export interface ListSecurityEventsParams {
  page?: number;
  limit?: number;
  userId?: string;
  eventType?: string;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listSecurityEvents(accessToken: string, params: ListSecurityEventsParams = {}) {
  return apiRequest<PaginatedResult<SecurityEvent>>(AUTH, `/v1/security-events${toQuery({ ...params })}`, { accessToken });
}

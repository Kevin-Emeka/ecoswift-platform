import { apiRequest } from './http-client';
import { API_URLS } from '../config';
import type { PaginatedResult } from '@ecoswift/types';

const AUDIT = API_URLS.audit;

export interface AuditLogEntry {
  id: string;
  actorUserId?: string;
  actorEmail?: string;
  actorType?: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  description?: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
  integrityHash: string;
  previousHash?: string;
  createdAt: string;
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  actionType?: string;
  from?: string;
  to?: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  entriesChecked: number;
  brokenAtId?: string;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listAuditLogs(accessToken: string, params: ListAuditLogsParams = {}) {
  return apiRequest<PaginatedResult<AuditLogEntry>>(AUDIT, `/v1/audit-logs${toQuery({ ...params })}`, { accessToken });
}

export function verifyAuditChain(accessToken: string) {
  return apiRequest<ChainVerificationResult>(AUDIT, '/v1/audit-logs/verify-chain', { accessToken });
}

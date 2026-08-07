import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const AUTH = API_URLS.auth;

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED';
  ownerUserId?: string | null;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  ownerUserId?: string;
  expiresAt?: string;
}

export interface CreateApiKeyResult {
  id: string;
  rawKey: string;
}

export function listApiKeys(accessToken: string) {
  return apiRequest<ApiKeySummary[]>(AUTH, '/v1/api-keys', { accessToken });
}

/** The raw key is returned exactly once in `rawKey` — it is never retrievable again after this call. */
export function createApiKey(accessToken: string, input: CreateApiKeyInput) {
  return apiRequest<CreateApiKeyResult>(AUTH, '/v1/api-keys', { method: 'POST', accessToken, body: input });
}

export function revokeApiKey(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/api-keys/${id}`, { method: 'DELETE', accessToken });
}

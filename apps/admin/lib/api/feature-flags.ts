import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const AUTH = API_URLS.auth;

export type FeatureFlagScope = 'GLOBAL' | 'CUSTOMER' | 'STAFF' | 'PRODUCT';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
  scope: FeatureFlagScope;
  scopeReference?: string | null;
  rolloutPercentage?: number | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  isEnabled?: boolean;
  scope?: FeatureFlagScope;
  scopeReference?: string;
  rolloutPercentage?: number;
}

export interface UpdateFeatureFlagInput {
  name?: string;
  description?: string;
  scope?: FeatureFlagScope;
  scopeReference?: string;
  rolloutPercentage?: number;
}

export function listFeatureFlags(accessToken: string) {
  return apiRequest<FeatureFlag[]>(AUTH, '/v1/feature-flags', { accessToken });
}

export function createFeatureFlag(accessToken: string, input: CreateFeatureFlagInput) {
  return apiRequest<FeatureFlag>(AUTH, '/v1/feature-flags', { method: 'POST', accessToken, body: input });
}

export function updateFeatureFlag(accessToken: string, id: string, input: UpdateFeatureFlagInput) {
  return apiRequest<FeatureFlag>(AUTH, `/v1/feature-flags/${id}`, { method: 'PATCH', accessToken, body: input });
}

export function toggleFeatureFlag(accessToken: string, id: string, isEnabled: boolean) {
  return apiRequest<FeatureFlag>(AUTH, `/v1/feature-flags/${id}/toggle`, { method: 'POST', accessToken, body: { isEnabled } });
}

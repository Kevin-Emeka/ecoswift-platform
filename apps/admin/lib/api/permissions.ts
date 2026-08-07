import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const AUTH = API_URLS.auth;

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string | null;
}

export interface PermissionGroup {
  resource: string;
  permissions: { id: string; code: string; action: string; description: string | null }[];
}

/** Full grantable-permission catalog — used to populate a permission picker when creating/editing a role. */
export function listPermissions(accessToken: string) {
  return apiRequest<Permission[]>(AUTH, '/v1/permissions', { accessToken });
}

export function listPermissionGroups(accessToken: string) {
  return apiRequest<PermissionGroup[]>(AUTH, '/v1/permissions/groups', { accessToken });
}

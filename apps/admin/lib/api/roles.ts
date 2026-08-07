import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const AUTH = API_URLS.auth;

export interface RoleListItem {
  id: string;
  name: string;
  description?: string | null;
  isSystemRole: boolean;
  parentRoleId?: string | null;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
  parentRole?: { id: string; name: string } | null;
  _count?: { rolePermissions: number; userRoles: number };
}

export interface RolePermissionEntry {
  roleId: string;
  permissionId: string;
  createdAt: string;
  permission: { id: string; resource: string; action: string; description?: string | null };
}

export interface RoleDetail extends RoleListItem {
  childRoles: { id: string; name: string }[];
  rolePermissions: RolePermissionEntry[];
}

export interface RoleAuditEntry {
  id: string;
  actorUserId?: string | null;
  actionType: string;
  resourceType: string;
  resourceId?: string | null;
  description?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  integrityHash: string;
  previousHash?: string | null;
  createdAt: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  parentRoleId?: string;
  isSensitive?: boolean;
}

export interface UpdateRoleInput {
  description?: string;
  parentRoleId?: string | null;
  isSensitive?: boolean;
}

export function listRoles(accessToken: string) {
  return apiRequest<RoleListItem[]>(AUTH, '/v1/roles', { accessToken });
}

export function getRole(accessToken: string, id: string) {
  return apiRequest<RoleDetail>(AUTH, `/v1/roles/${id}`, { accessToken });
}

export function getRoleAuditHistory(accessToken: string, id: string) {
  return apiRequest<RoleAuditEntry[]>(AUTH, `/v1/roles/${id}/audit-history`, { accessToken });
}

export function createRole(accessToken: string, input: CreateRoleInput) {
  return apiRequest<{ id: string; name: string }>(AUTH, '/v1/roles', { method: 'POST', accessToken, body: input });
}

export function updateRole(accessToken: string, id: string, input: UpdateRoleInput) {
  return apiRequest<{ message: string }>(AUTH, `/v1/roles/${id}`, { method: 'PATCH', accessToken, body: input });
}

export function deleteRole(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/roles/${id}`, { method: 'DELETE', accessToken });
}

export function grantRolePermission(accessToken: string, roleId: string, resource: string, action: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/roles/${roleId}/permissions`, {
    method: 'POST',
    accessToken,
    body: { resource, action },
  });
}

export function revokeRolePermission(accessToken: string, roleId: string, resource: string, action: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/roles/${roleId}/permissions/${resource}/${action}`, {
    method: 'DELETE',
    accessToken,
  });
}

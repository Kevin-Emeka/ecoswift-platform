import { apiRequest } from './http-client';
import { API_URLS } from '../config';

const AUTH = API_URLS.auth;

export interface UserRoleEntry {
  userId: string;
  roleId: string;
  assignedBy?: string | null;
  createdAt: string;
  role: { id: string; name: string; description?: string | null; isSensitive: boolean };
}

export interface UserRolesView {
  userRoles: UserRoleEntry[];
  effectivePermissions: string[];
}

export type AssignRoleResult = { status: 'ASSIGNED'; userId: string; roleId: string } | { status: 'PENDING_APPROVAL'; approvalId: string };

export function listUserRoles(accessToken: string, userId: string) {
  return apiRequest<UserRolesView>(AUTH, `/v1/user-roles/${userId}`, { accessToken });
}

/** Sensitive roles route to maker-checker approval — check `status` on the result rather than assuming immediate assignment. */
export function assignUserRole(accessToken: string, userId: string, roleId: string) {
  return apiRequest<AssignRoleResult>(AUTH, '/v1/user-roles', { method: 'POST', accessToken, body: { userId, roleId } });
}

export function revokeUserRole(accessToken: string, userId: string, roleId: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/user-roles/${userId}/${roleId}`, { method: 'DELETE', accessToken });
}

export interface PendingApproval {
  id: string;
  userId: string;
  roleId: string;
  requestedBy: string;
  status: string;
  createdAt: string;
  user: { id: string; email: string };
  role: { id: string; name: string };
}

export function listPendingRoleApprovals(accessToken: string) {
  return apiRequest<PendingApproval[]>(AUTH, '/v1/role-assignment-approvals', { accessToken });
}

export function approveRoleAssignment(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/role-assignment-approvals/${id}/approve`, { method: 'POST', accessToken });
}

export function rejectRoleAssignment(accessToken: string, id: string, reviewNote?: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/role-assignment-approvals/${id}/reject`, {
    method: 'POST',
    accessToken,
    body: { reviewNote },
  });
}

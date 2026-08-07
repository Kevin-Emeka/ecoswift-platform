import type { DomainEvent } from '../domain-event.base';

/**
 * Phase 3B — Authorization & Access Control events. Every role/permission
 * mutation and every sensitive-action approval decision publishes one of
 * these, in addition to (not instead of) the hash-chained `AuditLog` row
 * `AuthorizationAuditService` writes for the same action — see
 * docs/compliance-controls.md § Audit Logging for why both exist.
 */

export const ROLE_CREATED = 'authorization.role_created' as const;
export interface RoleCreatedPayload {
  roleId: string;
  name: string;
  createdBy: string;
}
export type RoleCreatedEvent = DomainEvent<typeof ROLE_CREATED, RoleCreatedPayload>;

export const ROLE_UPDATED = 'authorization.role_updated' as const;
export interface RoleUpdatedPayload {
  roleId: string;
  name: string;
  updatedBy: string;
}
export type RoleUpdatedEvent = DomainEvent<typeof ROLE_UPDATED, RoleUpdatedPayload>;

export const ROLE_DELETED = 'authorization.role_deleted' as const;
export interface RoleDeletedPayload {
  roleId: string;
  name: string;
  deletedBy: string;
}
export type RoleDeletedEvent = DomainEvent<typeof ROLE_DELETED, RoleDeletedPayload>;

export const PERMISSION_GRANTED_TO_ROLE = 'authorization.permission_granted_to_role' as const;
export interface PermissionGrantedToRolePayload {
  roleId: string;
  permissionId: string;
  permissionCode: string;
  grantedBy: string;
}
export type PermissionGrantedToRoleEvent = DomainEvent<typeof PERMISSION_GRANTED_TO_ROLE, PermissionGrantedToRolePayload>;

export const PERMISSION_REVOKED_FROM_ROLE = 'authorization.permission_revoked_from_role' as const;
export interface PermissionRevokedFromRolePayload {
  roleId: string;
  permissionId: string;
  permissionCode: string;
  revokedBy: string;
}
export type PermissionRevokedFromRoleEvent = DomainEvent<
  typeof PERMISSION_REVOKED_FROM_ROLE,
  PermissionRevokedFromRolePayload
>;

export const ROLE_ASSIGNED_TO_USER = 'authorization.role_assigned_to_user' as const;
export interface RoleAssignedToUserPayload {
  userId: string;
  roleId: string;
  roleName: string;
  assignedBy: string;
}
export type RoleAssignedToUserEvent = DomainEvent<typeof ROLE_ASSIGNED_TO_USER, RoleAssignedToUserPayload>;

export const ROLE_REVOKED_FROM_USER = 'authorization.role_revoked_from_user' as const;
export interface RoleRevokedFromUserPayload {
  userId: string;
  roleId: string;
  roleName: string;
  revokedBy: string;
}
export type RoleRevokedFromUserEvent = DomainEvent<typeof ROLE_REVOKED_FROM_USER, RoleRevokedFromUserPayload>;

export const ROLE_ASSIGNMENT_REQUESTED = 'authorization.role_assignment_requested' as const;
export interface RoleAssignmentRequestedPayload {
  approvalId: string;
  userId: string;
  roleId: string;
  roleName: string;
  requestedBy: string;
}
export type RoleAssignmentRequestedEvent = DomainEvent<
  typeof ROLE_ASSIGNMENT_REQUESTED,
  RoleAssignmentRequestedPayload
>;

export const ROLE_ASSIGNMENT_APPROVED = 'authorization.role_assignment_approved' as const;
export interface RoleAssignmentApprovedPayload {
  approvalId: string;
  userId: string;
  roleId: string;
  roleName: string;
  reviewedBy: string;
}
export type RoleAssignmentApprovedEvent = DomainEvent<typeof ROLE_ASSIGNMENT_APPROVED, RoleAssignmentApprovedPayload>;

export const ROLE_ASSIGNMENT_REJECTED = 'authorization.role_assignment_rejected' as const;
export interface RoleAssignmentRejectedPayload {
  approvalId: string;
  userId: string;
  roleId: string;
  roleName: string;
  reviewedBy: string;
  reviewNote?: string;
}
export type RoleAssignmentRejectedEvent = DomainEvent<typeof ROLE_ASSIGNMENT_REJECTED, RoleAssignmentRejectedPayload>;

export const API_KEY_CREATED = 'authorization.api_key_created' as const;
export interface ApiKeyCreatedPayload {
  apiKeyId: string;
  ownerUserId?: string;
  scopes: string[];
  createdBy: string;
}
export type ApiKeyCreatedEvent = DomainEvent<typeof API_KEY_CREATED, ApiKeyCreatedPayload>;

export const API_KEY_REVOKED = 'authorization.api_key_revoked' as const;
export interface ApiKeyRevokedPayload {
  apiKeyId: string;
  revokedBy: string;
}
export type ApiKeyRevokedEvent = DomainEvent<typeof API_KEY_REVOKED, ApiKeyRevokedPayload>;

export const FEATURE_FLAG_TOGGLED = 'authorization.feature_flag_toggled' as const;
export interface FeatureFlagToggledPayload {
  featureFlagId: string;
  key: string;
  isEnabled: boolean;
  toggledBy: string;
}
export type FeatureFlagToggledEvent = DomainEvent<typeof FEATURE_FLAG_TOGGLED, FeatureFlagToggledPayload>;

export const AUTHORIZATION_DENIED = 'authorization.access_denied' as const;
export interface AuthorizationDeniedPayload {
  userId: string;
  requiredPermissions: string[];
  resourceType?: string;
  resourceId?: string;
}
export type AuthorizationDeniedEvent = DomainEvent<typeof AUTHORIZATION_DENIED, AuthorizationDeniedPayload>;

export const PERMISSION_RESOLVER = Symbol('PERMISSION_RESOLVER');

/**
 * Resolves the *effective* permission set for a user — every permission
 * granted by every role the user holds, expanded through role hierarchy
 * (docs/rbac.md § Role Hierarchy). "Effective" is the operative word: a
 * caller of this port never needs to know or care how many roles a user
 * has, or how deep the hierarchy chain is — just the flattened result.
 */
export interface PermissionResolverPort {
  getEffectivePermissions(userId: string): Promise<Set<string>>;
  /** Invalidates any cached effective-permission set for a user — call after any role/permission change that could affect them. */
  invalidate(userId: string): Promise<void>;
}

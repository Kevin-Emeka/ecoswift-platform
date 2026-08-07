import { PERMISSION_CATALOG, PERMISSION_RESOURCES, ROLE_CATALOG, permissionCode } from './permission-catalog';

describe('permission catalog consistency', () => {
  it('has no duplicate resource:action pairs', () => {
    const codes = PERMISSION_CATALOG.map((p) => permissionCode(p.resource, p.action));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('only uses resources declared in PERMISSION_RESOURCES', () => {
    const known = new Set(PERMISSION_RESOURCES);
    for (const permission of PERMISSION_CATALOG) {
      expect(known.has(permission.resource)).toBe(true);
    }
  });

  it('gives every permission a non-empty description', () => {
    for (const permission of PERMISSION_CATALOG) {
      expect(permission.description.length).toBeGreaterThan(0);
    }
  });

  it('covers every declared resource with at least one permission', () => {
    const coveredResources = new Set(PERMISSION_CATALOG.map((p) => p.resource));
    for (const resource of PERMISSION_RESOURCES) {
      expect(coveredResources.has(resource)).toBe(true);
    }
  });
});

describe('role catalog consistency', () => {
  const validCodes = new Set(PERMISSION_CATALOG.map((p) => permissionCode(p.resource, p.action)));
  const roleNames = new Set(ROLE_CATALOG.map((r) => r.name));

  it('has no duplicate role names', () => {
    expect(roleNames.size).toBe(ROLE_CATALOG.length);
  });

  it('grants every role only permissions that exist in the catalog', () => {
    for (const role of ROLE_CATALOG) {
      for (const code of role.permissions) {
        expect(validCodes.has(code)).toBe(true);
      }
    }
  });

  it('never grants the same permission to a role twice', () => {
    for (const role of ROLE_CATALOG) {
      expect(new Set(role.permissions).size).toBe(role.permissions.length);
    }
  });

  it('only references parent roles that exist in the catalog', () => {
    for (const role of ROLE_CATALOG) {
      if (role.parentRoleName) {
        expect(roleNames.has(role.parentRoleName)).toBe(true);
      }
    }
  });

  it('has no cycles in the role hierarchy', () => {
    const parentOf = new Map(ROLE_CATALOG.map((r) => [r.name, r.parentRoleName]));
    for (const role of ROLE_CATALOG) {
      const seen = new Set<string>();
      let current: string | undefined = role.name;
      while (current) {
        expect(seen.has(current)).toBe(false);
        seen.add(current);
        current = parentOf.get(current);
      }
    }
  });

  it('marks every role broad enough to administer the system as sensitive', () => {
    expect(ROLE_CATALOG.find((r) => r.name === 'SYSTEM_ADMINISTRATOR')?.isSensitive).toBe(true);
    expect(ROLE_CATALOG.find((r) => r.name === 'SUPER_ADMINISTRATOR')?.isSensitive).toBe(true);
  });

  it('grants the CUSTOMER role no administrative or staff-only permissions', () => {
    const customer = ROLE_CATALOG.find((r) => r.name === 'CUSTOMER')!;
    const staffOnlyResources = ['users', 'roles', 'system_config', 'api_keys', 'feature_flags', 'webhooks', 'audit_logs'];
    for (const code of customer.permissions) {
      const [resource] = code.split(':');
      expect(staffOnlyResources).not.toContain(resource);
    }
  });

  it('grants AUDITOR only read/list/export actions, never a write action', () => {
    const auditor = ROLE_CATALOG.find((r) => r.name === 'AUDITOR')!;
    for (const code of auditor.permissions) {
      const [, action] = code.split(':');
      expect(['read', 'list', 'export']).toContain(action);
    }
  });

  it("expands SUPER_ADMINISTRATOR's own grants to the entire catalog", () => {
    const superAdmin = ROLE_CATALOG.find((r) => r.name === 'SUPER_ADMINISTRATOR')!;
    expect(new Set(superAdmin.permissions).size).toBe(PERMISSION_CATALOG.length);
  });
});

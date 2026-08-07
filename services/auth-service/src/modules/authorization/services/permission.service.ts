import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { permissionCode } from '@ecoswift/authz';

export interface PermissionGroupView {
  resource: string;
  permissions: { id: string; code: string; action: string; description: string | null }[];
}

/**
 * Read access to the `Permission` catalog. "Permission Groups" (Phase 3B
 * brief) is deliberately not a separate table — every permission's
 * `resource` field already is its group key (docs/rbac.md § Permission
 * Groups explains the reasoning); this service is what turns that implicit
 * grouping into the grouped view the API actually returns.
 */
@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  async groups(): Promise<PermissionGroupView[]> {
    const permissions = await this.list();
    const byResource = new Map<string, PermissionGroupView['permissions']>();

    for (const permission of permissions) {
      const bucket = byResource.get(permission.resource) ?? [];
      bucket.push({
        id: permission.id,
        code: permissionCode(permission.resource, permission.action),
        action: permission.action,
        description: permission.description,
      });
      byResource.set(permission.resource, bucket);
    }

    return [...byResource.entries()]
      .map(([resource, perms]) => ({ resource, permissions: perms }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  }
}

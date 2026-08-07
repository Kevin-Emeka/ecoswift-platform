/**
 * Regenerates docs/permission-matrix.md from
 * packages/authz/src/catalog/permission-catalog.ts. Run after any change
 * to PERMISSION_CATALOG/ROLE_CATALOG — never hand-edit the doc.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/generate-permission-matrix.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSION_CATALOG, PERMISSION_RESOURCES, ROLE_CATALOG, type RoleDefinition } from '../packages/authz/src/catalog/permission-catalog';

function effectivePermissions(role: RoleDefinition): Set<string> {
  const seen = new Set<string>();
  let current: RoleDefinition | undefined = role;
  const visited = new Set<string>();
  while (current && !visited.has(current.name)) {
    visited.add(current.name);
    for (const p of current.permissions) seen.add(p);
    current = current.parentRoleName ? ROLE_CATALOG.find((r) => r.name === current!.parentRoleName) : undefined;
  }
  return seen;
}

function main(): void {
  const roleEffective = new Map<string, Set<string>>();
  for (const role of ROLE_CATALOG) roleEffective.set(role.name, effectivePermissions(role));

  const roleHeaders = ROLE_CATALOG.map((r) => r.name.replace(/_/g, ' '));
  const totalPermissions = PERMISSION_CATALOG.length;

  const lines: string[] = [];
  lines.push('# Ecoswift Bank — Permission Matrix');
  lines.push('');
  lines.push(
    "**Phase 3B deliverable — generated from `packages/authz/src/catalog/permission-catalog.ts`, not hand-maintained.** Regenerate after any change to `PERMISSION_CATALOG`/`ROLE_CATALOG` rather than editing this file directly — see [`rbac.md`](rbac.md) for the reasoning behind each role's grant list, and [`authorization.md`](authorization.md) for how these permissions are actually enforced at request time.",
  );
  lines.push('');
  lines.push(
    "✅ marks a role's **effective** permission — direct grants plus everything inherited through role hierarchy (`rbac.md` § Role Hierarchy). Super Administrator shows every permission both because it inherits System Administrator's grants *and* because it is separately granted the full catalog directly (see the catalog file's own comment on why both).",
  );
  lines.push('');
  lines.push(`${totalPermissions} permissions across ${PERMISSION_RESOURCES.length} resources; ${ROLE_CATALOG.length} roles.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const resource of PERMISSION_RESOURCES) {
    const perms = PERMISSION_CATALOG.filter((p) => p.resource === resource);
    if (perms.length === 0) continue;

    lines.push(`## ${resource}`);
    lines.push('');
    lines.push(`| Permission | ${roleHeaders.join(' | ')} |`);
    lines.push(`|---|${roleHeaders.map(() => '---').join('|')}|`);
    for (const perm of perms) {
      const code = `${perm.resource}:${perm.action}`;
      const marks = ROLE_CATALOG.map((role) => (roleEffective.get(role.name)!.has(code) ? '✅' : ''));
      lines.push(`| \`${code}\` — ${perm.description} | ${marks.join(' | ')} |`);
    }
    lines.push('');
  }

  const outPath = join(__dirname, '..', 'docs', 'permission-matrix.md');
  writeFileSync(outPath, lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  console.log(`Wrote ${outPath}`);
}

main();

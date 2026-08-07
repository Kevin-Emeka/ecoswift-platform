'use client';

import { useParams } from 'next/navigation';
import { Alert, AlertDescription, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton, StatusBadge } from '@ecoswift/ui';
import { useRole, useRoleAuditHistory } from '../../../../lib/hooks/use-roles';
import { formatDateTime } from '../../../../lib/format';
import { ApiClientError } from '../../../../lib/api/http-client';

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const roleId = params.id;
  const { data: role, isLoading, isError, error } = useRole(roleId);
  const { data: history, isLoading: loadingHistory } = useRoleAuditHistory(roleId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !role) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load this role.'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{role.name}</h1>
          <p className="text-muted-foreground">{role.description ?? 'No description provided.'}</p>
        </div>
        <div className="flex items-center gap-2">
          {role.isSensitive && <Badge variant="warning">Sensitive</Badge>}
          <Badge variant={role.isSystemRole ? 'secondary' : 'outline'}>{role.isSystemRole ? 'System role' : 'Custom role'}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hierarchy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Parent role: </span>
            {role.parentRole?.name ?? 'None'}
          </p>
          <p>
            <span className="text-muted-foreground">Child roles: </span>
            {role.childRoles.length > 0 ? role.childRoles.map((c) => c.name).join(', ') : 'None'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Granted permissions ({role.rolePermissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {role.rolePermissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {role.rolePermissions.map((rp) => (
                <Badge key={`${rp.roleId}-${rp.permissionId}`} variant="outline">
                  {rp.permission.resource}:{rp.permission.action}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No permissions granted yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingHistory ? (
            <Skeleton className="h-32" />
          ) : history && history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.description ?? entry.actionType}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                </div>
                <StatusBadge status={entry.actionType} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No recorded changes to this role.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

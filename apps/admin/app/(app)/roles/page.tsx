'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@ecoswift/ui';
import { useCreateRole, usePermissionGroups, useRoles } from '../../../lib/hooks/use-roles';
import { grantRolePermission } from '../../../lib/api/roles';
import { ApiClientError } from '../../../lib/api/http-client';
import { useAuth } from '../../../lib/auth/auth-context';

function CreateRoleDialog() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSensitive, setIsSensitive] = React.useState(false);
  const [selectedPermissions, setSelectedPermissions] = React.useState<Set<string>>(new Set());

  const { data: groups, isLoading: loadingGroups } = usePermissionGroups();
  const createRole = useCreateRole();
  const { accessToken } = useAuth();

  function togglePermission(code: string) {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const role = await createRole.mutateAsync({
        name: name.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        description: description || undefined,
        isSensitive,
      });

      // Grant selected permissions one at a time — no bulk-grant endpoint exists.
      for (const code of selectedPermissions) {
        const [resource, action] = code.split(':') as [string, string];
        await grantRolePermission(accessToken!, role.id, resource, action);
      }

      toast({ title: 'Role created', description: `"${role.name}" is ready.`, variant: 'success' });
      setOpen(false);
      setName('');
      setDescription('');
      setIsSensitive(false);
      setSelectedPermissions(new Set());
    } catch (error) {
      toast({
        title: 'Could not create role',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a custom role</DialogTitle>
            <DialogDescription>Name is normalized to SCREAMING_SNAKE_CASE automatically.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="REGIONAL_MANAGER" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isSensitive} onChange={(e) => setIsSensitive(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Sensitive role (assignment requires maker-checker approval)
            </label>
            <div className="grid gap-2">
              <Label>Permissions</Label>
              {loadingGroups ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-border p-3">
                  {groups?.map((group) => (
                    <div key={group.resource}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.resource}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {group.permissions.map((permission) => (
                          <label key={permission.code} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedPermissions.has(permission.code)}
                              onChange={() => togglePermission(permission.code)}
                              className="h-4 w-4 rounded border-input"
                            />
                            {permission.action}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={createRole.isPending}>
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RolesPage() {
  const { data: roles, isLoading, isError, error } = useRoles();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">Manage role definitions and their granted permissions.</p>
        </div>
        <CreateRoleDialog />
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load roles.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : roles && roles.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Holders</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Link href={`/roles/${role.id}`} className="font-medium hover:underline">
                        {role.name}
                      </Link>
                      {role.isSensitive && (
                        <Badge variant="warning" className="ml-2">
                          Sensitive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{role.description ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{role.parentRole?.name ?? '—'}</TableCell>
                    <TableCell>{role._count?.rolePermissions ?? 0}</TableCell>
                    <TableCell>{role._count?.userRoles ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={role.isSystemRole ? 'secondary' : 'outline'}>{role.isSystemRole ? 'System' : 'Custom'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No roles found.</CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ecoswift/ui';
import { Pagination } from '../../../components/pagination';
import { useAuditLogs, useVerifyAuditChain } from '../../../lib/hooks/use-audit-logs';
import { formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

const ACTION_TYPES = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'FREEZE', 'UNFREEZE', 'EXPORT', 'VIEW'];

export default function AuditLogsPage() {
  const [page, setPage] = React.useState(1);
  const [resourceType, setResourceType] = React.useState('');
  const [actorUserId, setActorUserId] = React.useState('');
  const [actionType, setActionType] = React.useState('ALL');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const limit = 25;

  const { data, isLoading, isError, error } = useAuditLogs({
    page,
    limit,
    resourceType: resourceType || undefined,
    actorUserId: actorUserId || undefined,
    actionType: actionType === 'ALL' ? undefined : actionType,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  });

  const verifyChain = useVerifyAuditChain();

  function applyFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Every recorded action across the platform, tamper-evident via hash chaining.</p>
        </div>
        <Button variant="outline" onClick={() => verifyChain.mutate()} loading={verifyChain.isPending}>
          <ShieldCheck className="h-4 w-4" /> Verify chain integrity
        </Button>
      </div>

      {verifyChain.data && (
        <Alert variant={verifyChain.data.valid ? 'success' : 'destructive'}>
          <AlertDescription>
            {verifyChain.data.valid
              ? `Chain verified — ${verifyChain.data.entriesChecked} entries checked, no tampering detected.`
              : `Chain integrity broken at entry ${verifyChain.data.brokenAtId} (${verifyChain.data.entriesChecked} entries checked).`}
          </AlertDescription>
        </Alert>
      )}
      {verifyChain.isError && (
        <Alert variant="destructive">
          <AlertDescription>{verifyChain.error instanceof ApiClientError ? verifyChain.error.message : 'Chain verification failed.'}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid gap-1.5">
            <Label htmlFor="resourceType">Resource type</Label>
            <Input id="resourceType" placeholder="e.g. Account" value={resourceType} onChange={(e) => applyFilter(setResourceType)(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="actorUserId">Actor user id</Label>
            <Input id="actorUserId" placeholder="UUID" value={actorUserId} onChange={(e) => applyFilter(setActorUserId)(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="actionType">Action type</Label>
            <Select value={actionType} onValueChange={applyFilter(setActionType)}>
              <SelectTrigger id="actionType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'ALL' ? 'All actions' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => applyFilter(setFrom)(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => applyFilter(setTo)(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load audit logs.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : data && data.items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell>{entry.actorEmail ?? entry.actorUserId ?? 'System'}</TableCell>
                    <TableCell>
                      <StatusBadge status={entry.actionType} />
                    </TableCell>
                    <TableCell>
                      {entry.resourceType}
                      {entry.resourceId ? <span className="text-muted-foreground"> #{entry.resourceId.slice(0, 8)}</span> : null}
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-muted-foreground">{entry.description ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No audit entries match your filters.</CardContent>
        </Card>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
    </div>
  );
}

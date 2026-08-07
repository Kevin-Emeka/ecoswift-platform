'use client';

import * as React from 'react';
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  Input,
  Label,
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
import { useSecurityEvents } from '../../../lib/hooks/use-security-events';
import { formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

export default function SecurityEventsPage() {
  const [page, setPage] = React.useState(1);
  const [userId, setUserId] = React.useState('');
  const [eventType, setEventType] = React.useState('');
  const limit = 25;

  const { data, isLoading, isError, error } = useSecurityEvents({
    page,
    limit,
    userId: userId || undefined,
    eventType: eventType || undefined,
  });

  function applyFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Events</h1>
        <p className="text-muted-foreground">Login failures, suspicious sessions, and other security-relevant activity.</p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="userId">User id</Label>
            <Input id="userId" placeholder="UUID" value={userId} onChange={(e) => applyFilter(setUserId)(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eventType">Event type</Label>
            <Input
              id="eventType"
              placeholder="e.g. LOGIN_FAILED"
              value={eventType}
              onChange={(e) => applyFilter(setEventType)(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load security events.'}</AlertDescription>
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
                  <TableHead>User</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>Risk score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(event.createdAt)}</TableCell>
                    <TableCell>{event.userEmail ?? event.userId ?? 'Unknown'}</TableCell>
                    <TableCell>
                      <StatusBadge status={event.eventType} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{event.ipAddress ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{event.riskScore ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No security events match your filters.</CardContent>
        </Card>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
    </div>
  );
}

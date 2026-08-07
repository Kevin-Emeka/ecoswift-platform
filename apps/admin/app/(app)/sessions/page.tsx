'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ecoswift/ui';
import { useUserSessions } from '../../../lib/hooks/use-sessions';
import { formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

export default function SessionsPage() {
  const [userIdInput, setUserIdInput] = React.useState('');
  const [userId, setUserId] = React.useState('');

  const { data, isLoading, isError, error, isFetched } = useUserSessions(userId);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setUserId(userIdInput.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Session Viewer</h1>
        <p className="text-muted-foreground">Look up a staff or customer user by their user id to see their active sessions.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="userId">User id (UUID)</Label>
              <Input
                id="userId"
                placeholder="e.g. 3f2a1c9e-..."
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
              />
            </div>
            <Button type="submit">
              <Search className="h-4 w-4" /> Look up sessions
            </Button>
          </form>
        </CardContent>
      </Card>

      {!userId ? null : isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load sessions for this user.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : data && data.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Current</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.deviceName ?? session.userAgent ?? 'Unknown device'}</TableCell>
                    <TableCell className="text-muted-foreground">{session.ipAddress}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(session.issuedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(session.expiresAt)}</TableCell>
                    <TableCell>{session.isCurrent && <Badge variant="secondary">Current</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : isFetched ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No active sessions found for this user.</CardContent>
        </Card>
      ) : null}
    </div>
  );
}

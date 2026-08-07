'use client';

import { Laptop, LogOut, ShieldAlert, Smartphone } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, useToast } from '@ecoswift/ui';
import { useDevices, useRevokeDevice, useRevokeSession, useSessions } from '../../../lib/hooks/use-security';
import { formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

export default function SecurityPage() {
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: devices, isLoading: devicesLoading } = useDevices();
  const revokeSession = useRevokeSession();
  const revokeDevice = useRevokeDevice();
  const { toast } = useToast();

  async function handleRevokeSession(id: string) {
    try {
      await revokeSession.mutateAsync(id);
      toast({ title: 'Session revoked', variant: 'success' });
    } catch (error) {
      toast({ title: 'Could not revoke session', description: error instanceof ApiClientError ? error.message : undefined, variant: 'destructive' });
    }
  }

  async function handleRevokeDevice(id: string) {
    try {
      await revokeDevice.mutateAsync(id);
      toast({ title: 'Device revoked', description: 'Every session on that device has been signed out.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Could not revoke device', description: error instanceof ApiClientError ? error.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground">Review active sessions and trusted devices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Everywhere you&apos;re currently signed in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsLoading ? (
            <Skeleton className="h-20" />
          ) : sessions && sessions.length > 0 ? (
            sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Laptop className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {session.deviceName ?? 'Unknown device'} {session.isCurrent && <Badge variant="success" className="ml-2">This device</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress} · Signed in {formatDateTime(session.issuedAt)}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(session.id)} loading={revokeSession.isPending}>
                    <LogOut className="h-4 w-4" /> Revoke
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trusted devices</CardTitle>
          <CardDescription>Devices that have signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {devicesLoading ? (
            <Skeleton className="h-20" />
          ) : devices && devices.length > 0 ? (
            devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{device.deviceName ?? device.platform ?? 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.trustLevel} · Last seen {formatDateTime(device.lastSeenAt)}
                      {device.lastIpAddress ? ` · ${device.lastIpAddress}` : ''}
                    </p>
                  </div>
                </div>
                {!device.revokedAt && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevokeDevice(device.id)} loading={revokeDevice.isPending}>
                    <ShieldAlert className="h-4 w-4" /> Revoke
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No devices on record.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

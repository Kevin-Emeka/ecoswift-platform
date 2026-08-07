'use client';

import * as React from 'react';
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, ThemeToggle, useToast } from '@ecoswift/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { changePassword } from '../../../lib/api/auth';
import { useConsents, useRecordConsent } from '../../../lib/hooks/use-profile';
import { ApiClientError } from '../../../lib/api/http-client';

export default function SettingsPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const { data: consents } = useConsents();
  const recordConsent = useRecordConsent();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const marketingConsent = consents?.find((c) => c.consentType === 'MARKETING_COMMUNICATIONS');

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await changePassword(accessToken!, currentPassword, newPassword);
      toast({ title: 'Password changed', variant: 'success' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not change your password.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleMarketing(accepted: boolean) {
    try {
      await recordConsent.mutateAsync({ consentType: 'MARKETING_COMMUNICATIONS', version: '1.0', accepted });
      toast({ title: accepted ? 'Subscribed to updates' : 'Unsubscribed', variant: 'success' });
    } catch (err) {
      toast({ title: 'Could not update preference', description: err instanceof ApiClientError ? err.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your password, appearance, and communication preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose light, dark, or match your system.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" required minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button type="submit" loading={submitting}>
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Communication preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between text-sm">
            <span>Product updates &amp; offers</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!!marketingConsent?.accepted}
              onChange={(e) => toggleMarketing(e.target.checked)}
            />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { useAuth } from '../../lib/auth/auth-context';
import { ApiClientError } from '../../lib/api/http-client';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, completeMfaLogin } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [mfaToken, setMfaToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if ('mfaRequired' in result) {
        setMfaToken(result.mfaToken);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await completeMfaLogin(mfaToken, 'TOTP', code);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Invalid code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 text-2xl font-bold tracking-tight">
        {BRANDING.brandName} <span className="text-muted-foreground font-normal">Admin</span>
      </div>
      <div className="w-full max-w-md">
        {mfaToken ? (
          <Card className="animate-in">
            <CardHeader>
              <CardTitle>Two-factor verification</CardTitle>
              <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMfaVerify} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="code">Verification code</Label>
                  <Input id="code" inputMode="numeric" maxLength={8} required value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
                </div>
                <Button type="submit" className="w-full" loading={submitting}>
                  Verify
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-in">
            <CardHeader>
              <CardTitle>Staff sign-in</CardTitle>
              <CardDescription>Internal use only. Admin accounts are provisioned by other staff.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" loading={submitting}>
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">{BRANDING.tagline} &mdash; Internal admin console.</p>
    </div>
  );
}

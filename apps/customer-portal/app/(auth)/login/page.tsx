'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ecoswift/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { ApiClientError } from '../../../lib/api/http-client';

export default function LoginPage() {
  const router = useRouter();
  const { login, completeMfaLogin } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);
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

  if (mfaToken) {
    return (
      <Card className="animate-in">
        <CardHeader>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <CardTitle className="mt-3">Two-factor verification</CardTitle>
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
              <Input
                id="code"
                inputMode="numeric"
                maxLength={8}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                className="text-center text-lg tracking-[0.3em]"
              />
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Verify
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-in">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account.</CardDescription>
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
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-brand-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-[#2563EB]"
            />
            Remember me on this device
          </label>
          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" /> Secured with bank-grade encryption
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-brand-accent hover:underline">
            Open an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

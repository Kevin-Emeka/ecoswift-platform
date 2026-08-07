'use client';

import * as React from 'react';
import Link from 'next/link';
import { KeyRound, Mail } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ecoswift/ui';
import { forgotPassword } from '../../../lib/api/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email);
    } finally {
      // Enumeration-safe: auth-service always returns the same generic message, so the UI always shows the same success state.
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card className="animate-in">
        <CardHeader className="items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <Mail className="h-6 w-6 text-success" />
          </span>
          <CardTitle className="mt-3">Check your email</CardTitle>
          <CardDescription>If that email is registered, we&apos;ve sent a link to reset your password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-in">
      <CardHeader>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
          <KeyRound className="h-5 w-5" />
        </span>
        <CardTitle className="mt-3">Forgot your password?</CardTitle>
        <CardDescription>We&apos;ll email you a link to reset it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" loading={submitting}>
            Send reset link
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-brand-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

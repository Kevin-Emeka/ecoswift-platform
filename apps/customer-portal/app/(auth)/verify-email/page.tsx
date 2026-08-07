'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, LoadingSection } from '@ecoswift/ui';
import { verifyEmail } from '../../../lib/api/auth';
import { ApiClientError } from '../../../lib/api/http-client';

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<LoadingSection label="Loading" />}>
      <VerifyEmailForm />
    </React.Suspense>
  );
}

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error instanceof ApiClientError ? error.message : 'This link is invalid or has expired.');
      });
  }, [token]);

  if (status === 'loading') {
    return <LoadingSection label="Verifying your email" />;
  }

  return (
    <Card className="animate-in">
      <CardHeader className="items-center text-center">
        {status === 'success' ? (
          <CheckCircle2 className="h-12 w-12 text-success" />
        ) : (
          <XCircle className="h-12 w-12 text-destructive" />
        )}
        <CardTitle>{status === 'success' ? 'Email verified' : 'Verification failed'}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSection } from '@ecoswift/ui';
import { useAuth } from '../lib/auth/auth-context';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [isLoading, user, router]);

  return <LoadingSection label="Loading" />;
}

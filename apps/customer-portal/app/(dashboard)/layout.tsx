'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSection } from '@ecoswift/ui';
import { useAuth } from '../../lib/auth/auth-context';
import { AppSidebar } from '../../components/layout/app-sidebar';
import { AppTopbar } from '../../components/layout/app-topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <LoadingSection label="Loading your account" />;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 animate-in p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

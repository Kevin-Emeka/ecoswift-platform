'use client';

import * as React from 'react';
import { ThemeProvider, ToastProvider } from '@ecoswift/ui';
import { QueryProvider } from './query-provider';
import { AuthProvider } from '../../lib/auth/auth-context';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

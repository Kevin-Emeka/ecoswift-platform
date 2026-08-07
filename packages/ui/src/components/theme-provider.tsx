'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/** Wraps `next-themes` — `attribute="class"` matches the `.dark` class strategy both apps' `globals.css`/`tailwind.config.ts` already use. Wrap the app root with this once. */
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}

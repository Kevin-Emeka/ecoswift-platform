'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive';
  durationMs?: number;
}

interface ToastRecord extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const VARIANT_ICON = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
} as const;

const VARIANT_CLASS = {
  default: 'border-border bg-background text-foreground',
  success: 'border-success/50 bg-success/10 text-success',
  destructive: 'border-destructive/50 bg-destructive/10 text-destructive',
} as const;

/**
 * A lightweight, dependency-free toast system (context + portal, no Radix
 * primitive) — Milestone 1's "Error handling" / user-feedback surface for
 * both apps. Wrap the app root with `<ToastProvider>`; call `useToast().toast(...)`
 * from any client component.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...options, id }]);
      window.setTimeout(() => dismiss(id), options.durationMs ?? 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]">
            {toasts.map((t) => {
              const Icon = VARIANT_ICON[t.variant ?? 'default'];
              return (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    'animate-in pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg',
                    VARIANT_CLASS[t.variant ?? 'default'],
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{t.title}</p>
                    {t.description && <p className="mt-1 text-sm opacity-90">{t.description}</p>}
                  </div>
                  <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be used within a <ToastProvider>');
  }
  return ctx;
}

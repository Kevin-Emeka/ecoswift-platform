import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg';
  label?: string;
}

const SIZE_CLASS = { sm: 'h-4 w-4', default: 'h-6 w-6', lg: 'h-10 w-10' } as const;

export function Spinner({ className, size = 'default', label = 'Loading', ...props }: SpinnerProps) {
  return (
    <div role="status" className={cn('inline-flex items-center justify-center', className)} {...props}>
      <Loader2 className={cn('animate-spin text-muted-foreground', SIZE_CLASS[size])} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Full-section loading state — centers a spinner in whatever container it's placed in. */
export function LoadingSection({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] w-full items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}

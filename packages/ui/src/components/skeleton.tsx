import * as React from 'react';
import { cn } from '../lib/utils';

/** A loading placeholder — used across both apps while data is in flight, per Milestone 1's "Skeleton loaders" requirement. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton-pulse rounded-md bg-muted', className)} {...props} />;
}

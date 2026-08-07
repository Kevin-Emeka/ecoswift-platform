import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind class names, resolving conflicts (used by every Shadcn-derived component). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

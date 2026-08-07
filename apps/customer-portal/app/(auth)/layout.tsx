'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, ShieldCheck } from 'lucide-react';
import { BRANDING } from '@ecoswift/config/branding';

const DEFAULT_PANEL = {
  headline: <>The banking platform built for what&apos;s next.</>,
  subhead: `${BRANDING.tagline} — a production-grade platform for modern digital banking.`,
  points: [
    'Real double-entry ledger under every balance',
    'Multi-factor authentication on every account',
    'Full, tamper-evident audit trail',
    'Bank-grade encryption end to end',
  ],
  badge: 'Bank-grade security, always on',
};

const REGISTER_PANEL = {
  headline: <>A checking account built for how you actually bank.</>,
  subhead: 'No monthly fees, no minimum balance — open a checking account in minutes and start banking today.',
  points: [
    'No monthly fees, no minimum balance',
    'Real-time balance and transaction updates',
    'Multi-factor authentication on every account',
    'Bank-grade encryption end to end',
  ],
  badge: 'Open a checking account, free',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const panel = pathname?.startsWith('/register') ? REGISTER_PANEL : DEFAULT_PANEL;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-radial p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
          aria-hidden="true"
        />
        <Link href="/" className="relative flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-extrabold">
            {BRANDING.shortName.slice(0, 2)}
          </span>
          {BRANDING.brandName}
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">{panel.headline}</h1>
          <p className="mt-4 text-white/70">{panel.subhead}</p>
          <ul className="mt-8 space-y-3">
            {panel.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" /> {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-dark relative inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-white/80">
          <ShieldCheck className="h-4 w-4 text-brand-accent" /> {panel.badge}
        </div>
      </div>

      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
          <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-sm font-extrabold text-white">
              {BRANDING.shortName.slice(0, 2)}
            </span>
            {BRANDING.brandName}
          </Link>
          <div className="w-full max-w-md">{children}</div>
        </div>
        <p className="pb-8 text-center text-xs text-muted-foreground">{BRANDING.tagline}</p>
      </div>
    </div>
  );
}

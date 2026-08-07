'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Landmark,
  ScrollText,
  MonitorSmartphone,
  ShieldCheck,
  Settings2,
  AlertTriangle,
  Bell,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { useAuth } from '../../lib/auth/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { href: '/customers', label: 'Customers', icon: Users, permission: 'customers:list' },
  { href: '/accounts', label: 'Accounts', icon: Landmark, permission: 'accounts:list' },
  { href: '/transfer-review', label: 'Transfer Review', icon: ClipboardCheck, permission: 'transactions:approve' },
  { href: '/transfer-limits', label: 'Transfer Limits', icon: SlidersHorizontal, permission: 'transfer_limits:read' },
  { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText, permission: 'audit_logs:read' },
  { href: '/sessions', label: 'Sessions', icon: MonitorSmartphone, permission: 'users:read' },
  { href: '/roles', label: 'Roles & Permissions', icon: ShieldCheck, permission: 'roles:read' },
  { href: '/system-config', label: 'System Configuration', icon: Settings2, permission: 'feature_flags:read' },
  { href: '/security-events', label: 'Security Events', icon: AlertTriangle, permission: 'audit_logs:read' },
  { href: '/notifications', label: 'Notifications', icon: Bell, permission: 'notifications:send' },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-xs font-extrabold text-white">
            {BRANDING.shortName.slice(0, 2)}
          </span>
          <span>
            {BRANDING.brandName} <span className="font-normal text-muted-foreground">Admin</span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.filter((item) => item.permission === null || hasPermission(item.permission)).map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground shadow-premium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" /> Staff-only internal tooling
        </span>
      </div>
    </aside>
  );
}

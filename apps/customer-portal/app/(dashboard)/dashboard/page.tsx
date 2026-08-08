'use client';

import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Bell,
  FileText,
  Landmark,
  Laptop,
  Plus,
  Repeat,
  ShieldCheck,
  TrendingUp,
  User as UserIcon,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  StatusBadge,
} from '@ecoswift/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { useAccounts, useAccountTransactions } from '../../../lib/hooks/use-accounts';
import { useNotifications } from '../../../lib/hooks/use-notifications';
import { useSessions, useDevices } from '../../../lib/hooks/use-security';
import { useProfile } from '../../../lib/hooks/use-profile';
import { formatMoney, formatDateTime } from '../../../lib/format';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: accounts, isLoading } = useAccounts();
  const { data: profile } = useProfile();
  const { data: notifications } = useNotifications();
  const { data: sessions } = useSessions();
  const { data: devices } = useDevices();

  const totalsByCurrency = (accounts ?? []).reduce<Record<string, number>>((acc, account) => {
    acc[account.currencyCode] = (acc[account.currencyCode] ?? 0) + Number(account.availableBalance);
    return acc;
  }, {});
  const firstAccount = accounts && accounts.length > 0 ? accounts[0] : undefined;
  const { data: transactions } = useAccountTransactions(firstAccount?.id ?? '');
  const recentTransactions = (transactions ?? []).slice(0, 5);
  const activeSessionsCount = (sessions ?? []).length;
  const trustedDevicesCount = (devices ?? []).filter((d) => !d.revokedAt).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Welcome back, {user?.firstName}.
          </h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s an overview of your accounts.</p>
        </div>
        <Button variant="gradient" asChild>
          <Link href={firstAccount ? `/accounts/${firstAccount.id}` : '/accounts'}>
            <Plus className="h-4 w-4" /> Open account
          </Link>
        </Button>
      </div>

      {/* Stat / analytics cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            {Object.entries(totalsByCurrency).length > 0 ? (
              Object.entries(totalsByCurrency)
                .slice(0, 1)
                .map(([currency, total]) => (
                  <Card key={currency} className="card-lift bg-brand-gradient text-white">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-white/70">
                        Total balance ({currency})
                      </CardDescription>
                      <CardTitle className="text-3xl text-white">
                        {formatMoney(total, currency)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total balance</CardDescription>
                  <CardTitle className="text-3xl">$0.00</CardTitle>
                </CardHeader>
              </Card>
            )}
            <Card className="card-lift">
              <CardHeader className="pb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
                  <Wallet className="h-4 w-4" />
                </span>
                <CardDescription className="mt-2">Active accounts</CardDescription>
                <CardTitle className="text-2xl">{accounts?.length ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="card-lift">
              <CardHeader className="pb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <CardDescription className="mt-2">Known devices</CardDescription>
                <CardTitle className="text-2xl">{trustedDevicesCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="card-lift">
              <CardHeader className="pb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <Bell className="h-4 w-4" />
                </span>
                <CardDescription className="mt-2">Unread notifications</CardDescription>
                <CardTitle className="text-2xl">
                  {(notifications?.items ?? []).filter((n) => !n.readAt).length}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: accounts + transactions */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Your accounts</CardTitle>
                <CardDescription>Quick access to each account</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/accounts">
                  <Plus className="h-4 w-4" /> Open account
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </>
              ) : accounts && accounts.length > 0 ? (
                accounts.map((account) => (
                  <Link
                    key={account.id}
                    href={`/accounts/${account.id}`}
                    className="card-lift flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:border-brand-accent/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
                        <Landmark className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-medium">
                          {account.accountTypeCode.replace(/_/g, ' ')} — {account.accountNumber}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={account.status} />
                          <Badge variant="outline">{account.currencyCode}</Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatMoney(account.availableBalance, account.currencyCode)}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Landmark className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    You don&apos;t have any accounts yet.
                  </p>
                  <Button asChild>
                    <Link href="/accounts">
                      <Plus className="h-4 w-4" /> Open your first account
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {firstAccount && (
            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link href="/transfers">
                    <Repeat className="h-4 w-4" /> Transfer
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/beneficiaries">
                    <Users className="h-4 w-4" /> Beneficiaries
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/accounts/${firstAccount.id}`}>
                    <FileText className="h-4 w-4" /> Statements
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/security">
                    <ShieldCheck className="h-4 w-4" /> Review security
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent transactions</CardTitle>
                <CardDescription>
                  {firstAccount ? `From ${firstAccount.accountNumber}` : 'No account selected'}
                </CardDescription>
              </div>
              {firstAccount && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/accounts/${firstAccount.id}`}>
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              {recentTransactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </p>
              ) : (
                recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg px-2 py-3 hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          tx.transactionType === 'DEPOSIT'
                            ? 'flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success'
                            : 'flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive'
                        }
                      >
                        {tx.transactionType === 'DEPOSIT' ? (
                          <ArrowDownToLine className="h-4 w-4" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {tx.transactionType.toLowerCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(tx.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={
                        tx.transactionType === 'DEPOSIT'
                          ? 'font-semibold text-success'
                          : 'font-semibold text-destructive'
                      }
                    >
                      {tx.transactionType === 'DEPOSIT' ? '+' : '-'}
                      {formatMoney(tx.amount, tx.currencyCode)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: profile, security, notifications */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{profile?.customerNumber ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Profile status</span>
                <Badge
                  variant={profile?.profileCompletionStatus === 'COMPLETE' ? 'success' : 'warning'}
                >
                  {profile?.profileCompletionStatus === 'COMPLETE' ? 'Complete' : 'Incomplete'}
                </Badge>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/profile">
                  <UserIcon className="h-3.5 w-3.5" /> View profile
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-success" /> Active sessions
                </span>
                <span className="font-medium text-foreground">{activeSessionsCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Laptop className="h-4 w-4 text-brand-accent" /> Known devices
                </span>
                <span className="font-medium text-foreground">{trustedDevicesCount}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/security">
                  <ShieldCheck className="h-3.5 w-3.5" /> Manage security
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/notifications">
                  <TrendingUp className="h-3.5 w-3.5" /> All
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(notifications?.items ?? []).slice(0, 3).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                (notifications?.items ?? []).slice(0, 3).map((n) => (
                  <div key={n.id} className="rounded-lg px-2 py-2 hover:bg-accent">
                    <p className="truncate text-sm font-medium text-foreground">
                      {n.subject ?? 'Notification'}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated {formatDateTime(new Date().toISOString())}
      </p>
    </div>
  );
}

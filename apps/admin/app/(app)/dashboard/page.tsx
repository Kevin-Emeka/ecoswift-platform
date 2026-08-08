'use client';

import Link from 'next/link';
import { Users, Landmark, ScrollText, AlertTriangle, ArrowRight, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, StatusBadge, useToast } from '@ecoswift/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { useCustomers } from '../../../lib/hooks/use-customers';
import { useActivateAccount, useStaffAccounts } from '../../../lib/hooks/use-accounts';
import { useAuditLogs } from '../../../lib/hooks/use-audit-logs';
import { useSecurityEvents } from '../../../lib/hooks/use-security-events';
import { formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';
import type { AccountSummary } from '../../../lib/api/staff';

/** One row in the pending-activations widget — its own component since useActivateAccount needs a fixed accountId per hook call, not one shared across a mapped list. */
function PendingActivationRow({ account, onDone }: { account: AccountSummary; onDone: () => void }) {
  const activate = useActivateAccount(account.id);
  const { toast } = useToast();

  async function handleActivate() {
    try {
      await activate.mutateAsync({});
      toast({ title: 'Account activated', variant: 'success' });
      onDone();
    } catch (error) {
      toast({
        title: 'Could not activate this account',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg px-1 py-2 hover:bg-accent">
      <div className="min-w-0">
        <Link href={`/accounts/${account.id}`} className="truncate text-sm font-medium hover:underline">
          {account.accountNumber}
        </Link>
        <p className="text-xs text-muted-foreground">{account.customerNumber}</p>
      </div>
      <Button size="sm" onClick={handleActivate} loading={activate.isPending}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Activate
      </Button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading,
  tone,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  loading: boolean;
  tone: 'brand' | 'success' | 'warning' | 'destructive';
}) {
  const toneClasses: Record<typeof tone, string> = {
    brand: 'bg-brand-accent/10 text-brand-accent',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };
  return (
    <Card className="card-lift">
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 text-3xl font-bold tracking-tight">{value ?? 0}</p>}
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const canListCustomers = hasPermission('customers:list');
  const canListAccounts = hasPermission('accounts:list');
  const canReadAudit = hasPermission('audit_logs:read');

  const { data: customers, isLoading: loadingCustomers } = useCustomers({ page: 1, limit: 1 }, canListCustomers);
  const { data: accounts, isLoading: loadingAccounts } = useStaffAccounts({ page: 1, limit: 1 }, canListAccounts);
  const {
    data: pendingAccounts,
    isLoading: loadingPending,
    refetch: refetchPending,
  } = useStaffAccounts({ page: 1, limit: 5, status: 'PENDING_ACTIVATION' }, canListAccounts);
  const { data: auditLogs, isLoading: loadingAudit } = useAuditLogs({ page: 1, limit: 5 }, canReadAudit);
  const { data: securityEvents, isLoading: loadingSecurity } = useSecurityEvents({ page: 1, limit: 5 }, canReadAudit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Welcome back{user?.firstName ? `, ${user.firstName}` : ''}</h1>
          <p className="mt-1 text-muted-foreground">Ecoswift Bank internal admin console overview.</p>
        </div>
        <Badge variant="brand" className="w-fit gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin Console
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {canListCustomers && (
          <SummaryCard label="Total customers" value={customers?.total} icon={Users} loading={loadingCustomers} tone="brand" />
        )}
        {canListAccounts && (
          <SummaryCard label="Total accounts" value={accounts?.total} icon={Landmark} loading={loadingAccounts} tone="success" />
        )}
        {canListAccounts && (
          <SummaryCard label="Pending activation" value={pendingAccounts?.total} icon={Clock} loading={loadingPending} tone="warning" />
        )}
        {canReadAudit && (
          <SummaryCard label="Audit entries" value={auditLogs?.total} icon={ScrollText} loading={loadingAudit} tone="brand" />
        )}
        {canReadAudit && (
          <SummaryCard label="Security events" value={securityEvents?.total} icon={AlertTriangle} loading={loadingSecurity} tone="warning" />
        )}
      </div>

      {canListAccounts && pendingAccounts && pendingAccounts.total > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Accounts awaiting activation</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingPending ? (
              <>
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </>
            ) : (
              pendingAccounts.items.map((account) => (
                <PendingActivationRow key={account.id} account={account} onDone={refetchPending} />
              ))
            )}
            <Link
              href="/accounts?status=PENDING_ACTIVATION"
              className="flex items-center gap-1 pt-1 text-sm font-medium text-brand-accent hover:underline"
            >
              View all pending activations <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {canReadAudit && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent audit log entries</CardTitle>
              <ScrollText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingAudit ? (
                <>
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                </>
              ) : auditLogs && auditLogs.items.length > 0 ? (
                auditLogs.items.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg px-1 py-2 hover:bg-accent">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.description ?? `${entry.actionType} ${entry.resourceType}`}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <StatusBadge status={entry.actionType} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent audit entries.</p>
              )}
              <Link href="/audit-logs" className="flex items-center gap-1 pt-1 text-sm font-medium text-brand-accent hover:underline">
                View all audit logs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        )}

        {canReadAudit && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent security events</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSecurity ? (
                <>
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                </>
              ) : securityEvents && securityEvents.items.length > 0 ? (
                securityEvents.items.map((event) => (
                  <div key={event.id} className="flex items-center justify-between rounded-lg px-1 py-2 hover:bg-accent">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.userEmail ?? event.userId ?? 'Unknown user'}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                    </div>
                    <StatusBadge status={event.eventType} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent security events.</p>
              )}
              <Link href="/security-events" className="flex items-center gap-1 pt-1 text-sm font-medium text-brand-accent hover:underline">
                View all security events <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

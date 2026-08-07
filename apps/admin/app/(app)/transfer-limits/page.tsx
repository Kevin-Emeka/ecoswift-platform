'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@ecoswift/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { useCreateTransferLimit, useRetireTransferLimit, useTransferLimits } from '../../../lib/hooks/use-transfer-limits';
import { formatMoney, formatDate } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';
import type { TransferLimitScope } from '../../../lib/api/transfer-limits';

const SCOPES: TransferLimitScope[] = ['GLOBAL', 'TIER', 'CUSTOMER', 'ACCOUNT'];
const TIERS = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'];

function targetLabel(limit: { scope: TransferLimitScope; tier?: string; customerName?: string; accountNumber?: string }): string {
  switch (limit.scope) {
    case 'GLOBAL':
      return 'Everyone';
    case 'TIER':
      return limit.tier ?? '—';
    case 'CUSTOMER':
      return limit.customerName ?? '—';
    case 'ACCOUNT':
      return limit.accountNumber ?? '—';
  }
}

function CreateLimitDialog() {
  const [open, setOpen] = React.useState(false);
  const [scope, setScope] = React.useState<TransferLimitScope>('TIER');
  const [tier, setTier] = React.useState('TIER_0');
  const [customerId, setCustomerId] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [currencyCode, setCurrencyCode] = React.useState('USD');
  const [dailyLimit, setDailyLimit] = React.useState('');
  const [perTransactionLimit, setPerTransactionLimit] = React.useState('');
  const [monthlyLimit, setMonthlyLimit] = React.useState('');
  const { toast } = useToast();
  const create = useCreateTransferLimit();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Mirrors the backend's ordering check (and the DB's own CHECK
    // constraint) — catch it here first so a mistyped value doesn't need a
    // round trip to explain itself.
    const per = Number(perTransactionLimit);
    const daily = Number(dailyLimit);
    const monthly = Number(monthlyLimit);
    if (per > daily) {
      toast({ title: 'Invalid limits', description: 'Per-transaction limit cannot be greater than the daily limit.', variant: 'destructive' });
      return;
    }
    if (daily > monthly) {
      toast({ title: 'Invalid limits', description: 'Daily limit cannot be greater than the monthly limit.', variant: 'destructive' });
      return;
    }

    try {
      await create.mutateAsync({
        scope,
        tier: scope === 'TIER' ? tier : undefined,
        customerId: scope === 'CUSTOMER' ? customerId : undefined,
        accountId: scope === 'ACCOUNT' ? accountId : undefined,
        currencyCode,
        dailyLimit: Number(dailyLimit),
        perTransactionLimit: Number(perTransactionLimit),
        monthlyLimit: Number(monthlyLimit),
      });
      toast({ title: 'Transfer limit set', variant: 'success' });
      setOpen(false);
      setCustomerId('');
      setAccountId('');
      setDailyLimit('');
      setPerTransactionLimit('');
      setMonthlyLimit('');
    } catch (error) {
      toast({
        title: 'Could not set this limit',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Set a limit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Set a transfer limit</DialogTitle>
            <DialogDescription>
              The most specific scope wins: account &gt; customer &gt; KYC tier &gt; global default. Setting a new limit
              for a scope replaces the currently active one for that scope and currency.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="scope">Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as TransferLimitScope)}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {scope === 'TIER' && (
              <div className="grid gap-2">
                <Label htmlFor="tier">KYC tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger id="tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === 'CUSTOMER' && (
              <div className="grid gap-2">
                <Label htmlFor="customerId">Customer ID</Label>
                <Input id="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Copy from the Customers page" required />
              </div>
            )}

            {scope === 'ACCOUNT' && (
              <div className="grid gap-2">
                <Label htmlFor="accountId">Account ID</Label>
                <Input id="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Copy from the Accounts page" required />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="currencyCode">Currency</Label>
              <Input id="currencyCode" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} maxLength={3} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="perTransactionLimit">Per-transaction</Label>
                <Input id="perTransactionLimit" type="number" min="0" value={perTransactionLimit} onChange={(e) => setPerTransactionLimit(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dailyLimit">Daily</Label>
                <Input id="dailyLimit" type="number" min="0" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="monthlyLimit">Monthly</Label>
                <Input id="monthlyLimit" type="number" min="0" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} required />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={create.isPending}>
              Save limit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TransferLimitsPage() {
  const { hasPermission } = useAuth();
  const { data, isLoading, isError, error } = useTransferLimits();
  const retire = useRetireTransferLimit();
  const { toast } = useToast();

  async function handleRetire(id: string) {
    try {
      await retire.mutateAsync(id);
      toast({ title: 'Limit removed', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Could not remove this limit',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  const canManage = hasPermission('transfer_limits:create');
  const canDelete = hasPermission('transfer_limits:delete');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transfer Limits</h1>
          <p className="text-muted-foreground">Daily, per-transaction, and monthly ceilings enforced on customer transfers.</p>
        </div>
        {canManage && <CreateLimitDialog />}
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load transfer limits.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : data && data.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Per-transaction</TableHead>
                  <TableHead>Daily</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((limit) => (
                  <TableRow key={limit.id}>
                    <TableCell>
                      <Badge variant="outline">{limit.scope}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{targetLabel(limit)}</TableCell>
                    <TableCell>{formatMoney(limit.perTransactionLimit, limit.currencyCode)}</TableCell>
                    <TableCell>{formatMoney(limit.dailyLimit, limit.currencyCode)}</TableCell>
                    <TableCell>{formatMoney(limit.monthlyLimit, limit.currencyCode)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(limit.effectiveFrom)}</TableCell>
                    <TableCell>
                      {canDelete && limit.scope !== 'GLOBAL' && (
                        <Button variant="ghost" size="sm" onClick={() => handleRetire(limit.id)} disabled={retire.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No transfer limits configured.</CardContent>
        </Card>
      )}
    </div>
  );
}

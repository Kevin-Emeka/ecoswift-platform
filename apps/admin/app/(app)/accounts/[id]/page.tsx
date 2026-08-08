'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Ban, CheckCircle2, CircleDollarSign, Lock, Moon, ShieldOff, Snowflake, Unlock } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Skeleton,
  StatusBadge,
  useToast,
} from '@ecoswift/ui';
import {
  useActivateAccount,
  useCloseAccount,
  useCreditAccount,
  useFreezeAccount,
  useMarkAccountDormant,
  useRestrictAccount,
  useStaffAccount,
  useUnfreezeAccount,
  useUnrestrictAccount,
} from '../../../../lib/hooks/use-accounts';
import { formatMoney, formatDate } from '../../../../lib/format';
import { ApiClientError } from '../../../../lib/api/http-client';
import type { UseMutationResult } from '@tanstack/react-query';
import type { AccountActionResult, AccountStatusActionInput } from '../../../../lib/api/accounts';
import type { AdminCreditInput, AdminCreditResult } from '../../../../lib/api/staff';

function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  variant,
  mutation,
  onDone,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'default' | 'destructive';
  mutation: UseMutationResult<AccountActionResult, Error, AccountStatusActionInput>;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const { toast } = useToast();

  async function handleConfirm() {
    try {
      await mutation.mutateAsync({ reason: reason || undefined });
      toast({ title: `${title} succeeded`, variant: 'success' });
      setOpen(false);
      setReason('');
      onDone();
    } catch (error) {
      toast({
        title: `${title} failed`,
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add context for the audit trail" />
        </div>
        <DialogFooter>
          <Button variant={variant ?? 'default'} onClick={handleConfirm} loading={mutation.isPending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreditAccountDialog({
  mutation,
  currencyCode,
  onDone,
}: {
  mutation: UseMutationResult<AdminCreditResult, Error, AdminCreditInput>;
  currencyCode: string;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const { toast } = useToast();

  const amountValue = Number(amount);
  const canSubmit = amount.trim() !== '' && amountValue > 0 && reason.trim().length >= 5;

  async function handleConfirm() {
    try {
      await mutation.mutateAsync({ amount: amountValue, reason: reason.trim() });
      toast({ title: 'Account credited', description: `${formatMoney(String(amountValue), currencyCode)} added.`, variant: 'success' });
      setOpen(false);
      setAmount('');
      setReason('');
      onDone();
    } catch (error) {
      toast({
        title: 'Could not credit account',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CircleDollarSign className="h-4 w-4" /> Add funds
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credit this account</DialogTitle>
          <DialogDescription>
            Sandbox-only staff funding — e.g. backfilling an opening balance the customer couldn&apos;t self-declare at
            account opening. Posts a real ledger entry and is fully audited.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="credit-amount">Amount ({currencyCode})</Label>
            <Input
              id="credit-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="credit-reason">Reason (required)</Label>
            <Input
              id="credit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Opening-balance funding per support ticket #4521"
            />
            <p className="text-xs text-muted-foreground">Recorded on the transaction and the audit log.</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} loading={mutation.isPending} disabled={!canSubmit}>
            Credit account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;
  const { data: account, isLoading, isError, error, refetch } = useStaffAccount(accountId);

  const freeze = useFreezeAccount(accountId);
  const activate = useActivateAccount(accountId);
  const unfreeze = useUnfreezeAccount(accountId);
  const close = useCloseAccount(accountId);
  const restrict = useRestrictAccount(accountId);
  const unrestrict = useUnrestrictAccount(accountId);
  const markDormant = useMarkAccountDormant(accountId);
  const credit = useCreditAccount(accountId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (isError || !account) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load this account.'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{account.accountNumber}</h1>
          <p className="text-muted-foreground">Customer {account.customerNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={account.status} />
          <Badge variant="outline">{account.currencyCode}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatMoney(account.availableBalance, account.currencyCode)}</p>
          <p className="text-sm text-muted-foreground">Available balance</p>
          <p className="mt-4 text-sm text-muted-foreground">Account type: {account.accountTypeCode.replace(/_/g, ' ')}</p>
          <p className="text-sm text-muted-foreground">Opened {formatDate(account.openedAt)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {account.status === 'PENDING_ACTIVATION' && (
            <ActionDialog
              trigger={
                <Button>
                  <CheckCircle2 className="h-4 w-4" /> Activate
                </Button>
              }
              title="Activate this account"
              description="Reviews and approves this newly-opened account, making it usable. Only staff can do this — self-service activation was removed."
              confirmLabel="Activate"
              mutation={activate}
              onDone={refetch}
            />
          )}
          <CreditAccountDialog mutation={credit} currencyCode={account.currencyCode} onDone={refetch} />
          <ActionDialog
            trigger={
              <Button variant="secondary">
                <Snowflake className="h-4 w-4" /> Freeze
              </Button>
            }
            title="Freeze account"
            description="Temporarily blocks all activity on this account."
            confirmLabel="Freeze"
            variant="destructive"
            mutation={freeze}
            onDone={refetch}
          />
          <ActionDialog
            trigger={
              <Button variant="secondary">
                <Unlock className="h-4 w-4" /> Unfreeze
              </Button>
            }
            title="Unfreeze account"
            description="This will restore the account to ACTIVE status."
            confirmLabel="Unfreeze"
            mutation={unfreeze}
            onDone={refetch}
          />
          <ActionDialog
            trigger={
              <Button variant="secondary">
                <ShieldOff className="h-4 w-4" /> Suspend
              </Button>
            }
            title="Suspend account"
            description="Places a compliance/risk hold on this account (RESTRICTED status)."
            confirmLabel="Suspend"
            variant="destructive"
            mutation={restrict}
            onDone={refetch}
          />
          <ActionDialog
            trigger={
              <Button variant="secondary">
                <Lock className="h-4 w-4" /> Unsuspend
              </Button>
            }
            title="Unsuspend account"
            description="Lifts the compliance/risk hold and restores the account to ACTIVE status."
            confirmLabel="Unsuspend"
            mutation={unrestrict}
            onDone={refetch}
          />
          <ActionDialog
            trigger={
              <Button variant="secondary">
                <Moon className="h-4 w-4" /> Mark dormant
              </Button>
            }
            title="Mark account dormant"
            description="Marks an inactive account as DORMANT."
            confirmLabel="Mark dormant"
            mutation={markDormant}
            onDone={refetch}
          />
          <ActionDialog
            trigger={
              <Button variant="destructive">
                <Ban className="h-4 w-4" /> Close
              </Button>
            }
            title="Close account"
            description="This permanently closes the account. This action cannot be undone."
            confirmLabel="Close account"
            variant="destructive"
            mutation={close}
            onDone={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}

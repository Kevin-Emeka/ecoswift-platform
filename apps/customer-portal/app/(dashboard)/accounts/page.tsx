'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import {
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  useToast,
} from '@ecoswift/ui';
import { useAccounts, useOpenAccount } from '../../../lib/hooks/use-accounts';
import { formatMoney } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

const ACCOUNT_TYPES = [
  { code: 'CURRENT', label: 'Current Account' },
  { code: 'SAVINGS', label: 'Savings Account' },
  { code: 'FIXED_DEPOSIT', label: 'Fixed Deposit Account' },
  { code: 'BUSINESS', label: 'Business Account' },
] as const;

const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR'];

const openAccountSchema = z.object({
  accountTypeCode: z.enum(['CURRENT', 'SAVINGS', 'FIXED_DEPOSIT', 'BUSINESS']),
  currencyCode: z.string().min(3).max(3),
});

type OpenAccountForm = z.infer<typeof openAccountSchema>;

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const openAccount = useOpenAccount();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const form = useForm<OpenAccountForm>({
    resolver: zodResolver(openAccountSchema),
    defaultValues: { accountTypeCode: 'SAVINGS', currencyCode: 'USD' },
  });

  async function onSubmit(values: OpenAccountForm) {
    try {
      const account = await openAccount.mutateAsync(values);
      toast({ title: 'Account opened', description: `Account ${account.accountNumber} is ready.`, variant: 'success' });
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: 'Could not open account',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">Manage your bank accounts.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Open account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Open a new account</DialogTitle>
                <DialogDescription>Choose a product and currency.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="accountTypeCode">Account type</Label>
                  <Select
                    defaultValue={form.getValues('accountTypeCode')}
                    onValueChange={(value) => form.setValue('accountTypeCode', value as OpenAccountForm['accountTypeCode'])}
                  >
                    <SelectTrigger id="accountTypeCode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((type) => (
                        <SelectItem key={type.code} value={type.code}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currencyCode">Currency</Label>
                  <Select
                    defaultValue={form.getValues('currencyCode')}
                    onValueChange={(value) => form.setValue('currencyCode', value)}
                  >
                    <SelectTrigger id="currencyCode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  New accounts open with a $0 balance — fund it with a transfer once it&apos;s active. Fixed Deposit
                  accounts aren&apos;t self-service-openable yet since they require a minimum balance at opening.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" loading={form.formState.isSubmitting}>
                  Open account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <Link key={account.id} href={`/accounts/${account.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{account.accountTypeCode.replace(/_/g, ' ')}</CardTitle>
                    <StatusBadge status={account.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{account.accountNumber}</p>
                  <p className="mt-2 text-xl font-semibold">{formatMoney(account.availableBalance, account.currencyCode)}</p>
                  <Badge variant="outline" className="mt-2">
                    {account.currencyCode}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            You don&apos;t have any accounts yet. Open one to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

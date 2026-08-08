'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Ban, CalendarClock, Landmark, Repeat, ShieldCheck } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@ecoswift/ui';
import {
  useAccounts,
  useAccountTransactions,
  useExternalTransfer,
  useInternalTransfer,
} from '../../../lib/hooks/use-accounts';
import { useBeneficiaries } from '../../../lib/hooks/use-beneficiaries';
import {
  useCancelScheduledTransfer,
  useCreateScheduledTransfer,
  useScheduledTransfers,
} from '../../../lib/hooks/use-scheduled-transfers';
import { listCountries } from '../../../lib/api/reference-data';
import { formatMoney, formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';
import type { Account } from '../../../lib/api/accounts';

// Loaded client-side only — see the identical note on the register page's
// Combobox import: this is a first-use RSC/webpack module-id issue, not a
// real coupling requirement.
const Combobox = dynamic(() => import('@ecoswift/ui').then((mod) => mod.Combobox), { ssr: false });

/**
 * Shared step-up state for both transfer forms — when the API rejects an
 * attempt with `MFA_REQUIRED`, the original form values are stashed here
 * so the same request can be resubmitted with a code attached, rather
 * than making the customer re-enter everything.
 */
function useMfaGate<TValues>() {
  const [pendingValues, setPendingValues] = React.useState<TValues | null>(null);
  const [mfaCode, setMfaCode] = React.useState('');

  return {
    pendingValues,
    mfaCode,
    setMfaCode,
    requestStepUp: (values: TValues) => {
      setPendingValues(values);
      setMfaCode('');
    },
    reset: () => {
      setPendingValues(null);
      setMfaCode('');
    },
  };
}

function MfaStepUpCard<TValues>({
  gate,
  loading,
  onConfirm,
  description = 'This transfer needs extra verification. Enter the 6-digit code from your authenticator app to continue.',
}: {
  gate: ReturnType<typeof useMfaGate<TValues>>;
  loading: boolean;
  onConfirm: () => void;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-accent" /> Verify it&apos;s you
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="grid gap-2">
          <Label htmlFor="mfaCode">Verification code</Label>
          <Input
            id="mfaCode"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={gate.mfaCode}
            onChange={(e) => gate.setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={gate.reset}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            loading={loading}
            disabled={gate.mfaCode.length !== 6}
            onClick={onConfirm}
          >
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TransfersPage() {
  const { data: accounts, isLoading } = useAccounts();
  const activeAccounts = React.useMemo(
    () => (accounts ?? []).filter((a) => a.status === 'ACTIVE'),
    [accounts],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted-foreground">
            Move money between your accounts or send to someone else.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Repeat className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You need an active account before you can transfer money.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transfers</h1>
        <p className="text-muted-foreground">
          Move money between your accounts or send to someone else.
        </p>
      </div>

      <Tabs defaultValue="internal">
        <TabsList>
          <TabsTrigger value="internal">Between my accounts</TabsTrigger>
          <TabsTrigger value="external">To someone else</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>
        <TabsContent value="internal">
          <InternalTransferForm accounts={activeAccounts} />
        </TabsContent>
        <TabsContent value="external">
          <ExternalTransferForm accounts={activeAccounts} />
        </TabsContent>
        <TabsContent value="scheduled">
          <ScheduledTransfersPanel accounts={activeAccounts} />
        </TabsContent>
      </Tabs>

      <RecentTransfers accountIds={activeAccounts.map((a) => a.id)} />
    </div>
  );
}

const internalTransferSchema = z
  .object({
    sourceAccountId: z.string().uuid('Select a source account'),
    destinationAccountId: z.string().uuid('Select a destination account'),
    amount: z.coerce.number().min(0.01, 'Enter an amount greater than 0'),
    description: z.string().max(200).optional(),
  })
  .refine((values) => values.sourceAccountId !== values.destinationAccountId, {
    message: 'Source and destination accounts must be different',
    path: ['destinationAccountId'],
  });

type InternalTransferForm = z.infer<typeof internalTransferSchema>;

function InternalTransferForm({ accounts }: { accounts: Account[] }) {
  const transfer = useInternalTransfer();
  const { toast } = useToast();
  const mfaGate = useMfaGate<InternalTransferForm>();

  const form = useForm<InternalTransferForm>({
    resolver: zodResolver(internalTransferSchema),
    defaultValues: {
      sourceAccountId: '',
      destinationAccountId: '',
      amount: undefined,
      description: '',
    },
  });

  const sourceAccountId = form.watch('sourceAccountId');
  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);

  async function submitTransfer(values: InternalTransferForm, mfaCode?: string) {
    try {
      const result = await transfer.mutateAsync({ ...values, mfaCode });
      if (result.status === 'PENDING') {
        toast({
          title: 'Submitted for review',
          description:
            'This transfer was flagged for extra verification and needs staff approval before it completes.',
        });
      } else {
        toast({
          title: 'Transfer completed',
          description: `${formatMoney(result.amount, result.currencyCode)} moved successfully. Reference ${result.transactionReference}.`,
          variant: 'success',
        });
      }
      mfaGate.reset();
      form.reset({
        sourceAccountId: values.sourceAccountId,
        destinationAccountId: '',
        amount: undefined,
        description: '',
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'MFA_REQUIRED') {
        mfaGate.requestStepUp(values);
        return;
      }
      toast({
        title: 'Transfer failed',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  if (mfaGate.pendingValues) {
    return (
      <MfaStepUpCard
        gate={mfaGate}
        loading={transfer.isPending}
        onConfirm={() => submitTransfer(mfaGate.pendingValues!, mfaGate.mfaCode)}
      />
    );
  }

  if (accounts.length < 2) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          You need at least two active accounts to transfer between them. Open a second account to
          get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New transfer</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((values) => submitTransfer(values))}
          className="space-y-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="sourceAccountId">From</Label>
            <Select
              onValueChange={(value) =>
                form.setValue('sourceAccountId', value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="sourceAccountId">
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountTypeCode.replace(/_/g, ' ')} — {account.accountNumber} (
                    {formatMoney(account.availableBalance, account.currencyCode)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.sourceAccountId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.sourceAccountId.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="destinationAccountId">To</Label>
            <Select
              onValueChange={(value) =>
                form.setValue('destinationAccountId', value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="destinationAccountId">
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== sourceAccountId)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountTypeCode.replace(/_/g, ' ')} — {account.accountNumber}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {form.formState.errors.destinationAccountId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.destinationAccountId.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">
              Amount{sourceAccount ? ` (${sourceAccount.currencyCode})` : ''}
            </Label>
            <Input id="amount" type="number" step="0.01" min="0.01" {...form.register('amount')} />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Note (optional)</Label>
            <Input
              id="description"
              placeholder="e.g. Moving to savings"
              {...form.register('description')}
            />
          </div>

          <Alert>
            <AlertDescription>
              Internal transfers post instantly against a real double-entry ledger.
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" loading={transfer.isPending}>
            Transfer funds
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const externalTransferSchema = z.object({
  sourceAccountId: z.string().uuid('Select a source account'),
  beneficiaryName: z.string().min(1, 'Required').max(120),
  accountNumber: z.string().min(4, 'Enter the account number or IBAN').max(34),
  bankName: z.string().min(1, 'Required').max(120),
  swiftBic: z
    .string()
    .min(8, 'SWIFT/BIC codes are 8 or 11 characters')
    .max(11, 'SWIFT/BIC codes are 8 or 11 characters')
    .transform((v) => v.toUpperCase()),
  bankCountryCode: z.string().length(2, "Select the bank's country"),
  bankAddress: z.string().min(1, 'Required').max(250),
  routingNumber: z.string().max(20).optional(),
  amount: z.coerce.number().min(0.01, 'Enter an amount greater than 0'),
  description: z.string().max(200).optional(),
});

type ExternalTransferForm = z.infer<typeof externalTransferSchema>;

function ExternalTransferForm({ accounts }: { accounts: Account[] }) {
  const transfer = useExternalTransfer();
  const { toast } = useToast();
  const mfaGate = useMfaGate<ExternalTransferForm>();
  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: listCountries });
  const countryOptions = React.useMemo(
    () => (countries ?? []).map((c) => ({ value: c.isoCode, label: c.name, keywords: c.isoCode })),
    [countries],
  );

  const form = useForm<ExternalTransferForm>({
    resolver: zodResolver(externalTransferSchema),
    defaultValues: {
      sourceAccountId: '',
      beneficiaryName: '',
      accountNumber: '',
      bankName: '',
      swiftBic: '',
      bankCountryCode: '',
      bankAddress: '',
      routingNumber: '',
      amount: undefined,
      description: '',
    },
  });

  const sourceAccountId = form.watch('sourceAccountId');
  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const bankCountryCode = form.watch('bankCountryCode');

  async function submitTransfer(values: ExternalTransferForm, mfaCode?: string) {
    if (!sourceAccount) return;
    const { sourceAccountId: srcId, ...wireDetails } = values;
    try {
      const result = await transfer.mutateAsync({
        sourceAccountId: srcId,
        ...wireDetails,
        currencyCode: sourceAccount.currencyCode,
        mfaCode,
      });
      if (result.status === 'PENDING') {
        toast({
          title: 'Submitted for review',
          description:
            'This transfer was flagged for extra verification and needs staff approval before it completes.',
        });
      } else {
        toast({
          title: 'Wire transfer completed',
          description: `${formatMoney(result.amount, result.currencyCode)} sent. Reference ${result.transactionReference}.`,
          variant: 'success',
        });
      }
      mfaGate.reset();
      form.reset({
        sourceAccountId: values.sourceAccountId,
        beneficiaryName: '',
        accountNumber: '',
        bankName: '',
        swiftBic: '',
        bankCountryCode: '',
        bankAddress: '',
        routingNumber: '',
        amount: undefined,
        description: '',
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'MFA_REQUIRED') {
        mfaGate.requestStepUp(values);
        return;
      }
      toast({
        title: 'Transfer failed',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  if (mfaGate.pendingValues) {
    return (
      <MfaStepUpCard
        gate={mfaGate}
        loading={transfer.isPending}
        onConfirm={() => submitTransfer(mfaGate.pendingValues!, mfaGate.mfaCode)}
        description="Every wire transfer requires confirmation. We emailed a 6-digit code to your registered email address — enter it below to complete this transfer."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-brand-accent" /> Send an international wire
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((values) => submitTransfer(values))}
          className="space-y-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="extSourceAccountId">From</Label>
            <Select
              onValueChange={(value) =>
                form.setValue('sourceAccountId', value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="extSourceAccountId">
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountTypeCode.replace(/_/g, ' ')} — {account.accountNumber} (
                    {formatMoney(account.availableBalance, account.currencyCode)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.sourceAccountId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.sourceAccountId.message}
              </p>
            )}
          </div>

          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Beneficiary
          </p>

          <div className="grid gap-2">
            <Label htmlFor="beneficiaryName">Beneficiary full name</Label>
            <Input
              id="beneficiaryName"
              placeholder="Jane Doe"
              {...form.register('beneficiaryName')}
            />
            {form.formState.errors.beneficiaryName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.beneficiaryName.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="accountNumber">Account number / IBAN</Label>
            <Input
              id="accountNumber"
              placeholder="GB29NWBK60161331926819"
              {...form.register('accountNumber')}
            />
            {form.formState.errors.accountNumber && (
              <p className="text-xs text-destructive">
                {form.formState.errors.accountNumber.message}
              </p>
            )}
          </div>

          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Beneficiary&apos;s bank
          </p>

          <div className="grid gap-2">
            <Label htmlFor="bankName">Bank name</Label>
            <Input
              id="bankName"
              placeholder="National Westminster Bank"
              {...form.register('bankName')}
            />
            {form.formState.errors.bankName && (
              <p className="text-xs text-destructive">{form.formState.errors.bankName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="swiftBic">SWIFT / BIC code</Label>
              <Input
                id="swiftBic"
                placeholder="NWBKGB2L"
                className="uppercase"
                {...form.register('swiftBic')}
              />
              {form.formState.errors.swiftBic && (
                <p className="text-xs text-destructive">{form.formState.errors.swiftBic.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bankCountryCode">Bank country</Label>
              <Combobox
                id="bankCountryCode"
                options={countryOptions}
                value={bankCountryCode}
                onChange={(value) =>
                  form.setValue('bankCountryCode', value, { shouldValidate: true })
                }
                placeholder="Select country"
                searchPlaceholder="Search countries…"
                emptyMessage="No country found."
                invalid={!!form.formState.errors.bankCountryCode}
              />
              {form.formState.errors.bankCountryCode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bankCountryCode.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bankAddress">Bank address</Label>
            <Input
              id="bankAddress"
              placeholder="250 Bishopsgate, London EC2M 4AA, United Kingdom"
              {...form.register('bankAddress')}
            />
            {form.formState.errors.bankAddress && (
              <p className="text-xs text-destructive">
                {form.formState.errors.bankAddress.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="routingNumber">Routing number / sort code (optional)</Label>
            <Input
              id="routingNumber"
              placeholder="Only needed for some corridors, e.g. a USD wire's domestic leg"
              {...form.register('routingNumber')}
            />
          </div>

          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payment
          </p>

          <div className="grid gap-2">
            <Label htmlFor="extAmount">
              Amount{sourceAccount ? ` (${sourceAccount.currencyCode})` : ''}
            </Label>
            <Input
              id="extAmount"
              type="number"
              step="0.01"
              min="0.01"
              {...form.register('amount')}
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="extDescription">Purpose of payment (optional)</Label>
            <Input
              id="extDescription"
              placeholder="e.g. Invoice #4521"
              {...form.register('description')}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={transfer.isPending}
            disabled={!sourceAccount}
          >
            Send wire transfer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const scheduleSchema = z
  .object({
    transferType: z.enum(['INTERNAL', 'EXTERNAL']),
    sourceAccountId: z.string().uuid('Select a source account'),
    destinationAccountId: z.string().optional(),
    beneficiaryId: z.string().optional(),
    amount: z.coerce.number().min(0.01, 'Enter an amount greater than 0'),
    description: z.string().max(200).optional(),
    frequency: z.enum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY']),
    startAt: z.string().min(1, 'Choose a date and time'),
    endDate: z.string().optional(),
  })
  .refine((v) => v.transferType !== 'INTERNAL' || !!v.destinationAccountId, {
    message: 'Select a destination account',
    path: ['destinationAccountId'],
  })
  .refine((v) => v.transferType !== 'EXTERNAL' || !!v.beneficiaryId, {
    message: 'Select a beneficiary',
    path: ['beneficiaryId'],
  });

type ScheduleForm = z.infer<typeof scheduleSchema>;

const FREQUENCY_LABELS: Record<ScheduleForm['frequency'], string> = {
  ONE_TIME: 'One time',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

function ScheduledTransfersPanel({ accounts }: { accounts: Account[] }) {
  const { data: beneficiaries } = useBeneficiaries();
  const verifiedBeneficiaries = (beneficiaries ?? []).filter((b) => b.status === 'ACTIVE');
  const { data: scheduledTransfers, isLoading } = useScheduledTransfers();
  const createScheduled = useCreateScheduledTransfer();
  const cancelScheduled = useCancelScheduledTransfer();
  const { toast } = useToast();

  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      transferType: 'INTERNAL',
      sourceAccountId: '',
      destinationAccountId: '',
      beneficiaryId: '',
      amount: undefined,
      description: '',
      frequency: 'ONE_TIME',
      startAt: '',
      endDate: '',
    },
  });

  const transferType = form.watch('transferType');
  const frequency = form.watch('frequency');
  const sourceAccountId = form.watch('sourceAccountId');
  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);

  async function onSubmit(values: ScheduleForm) {
    try {
      await createScheduled.mutateAsync({
        sourceAccountId: values.sourceAccountId,
        input: {
          transferType: values.transferType,
          destinationAccountId:
            values.transferType === 'INTERNAL' ? values.destinationAccountId : undefined,
          beneficiaryId: values.transferType === 'EXTERNAL' ? values.beneficiaryId : undefined,
          amount: values.amount,
          description: values.description,
          frequency: values.frequency,
          startAt: new Date(values.startAt).toISOString(),
          endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        },
      });
      toast({ title: 'Transfer scheduled', variant: 'success' });
      form.reset({
        ...form.getValues(),
        destinationAccountId: '',
        beneficiaryId: '',
        amount: undefined,
        description: '',
        startAt: '',
        endDate: '',
      });
    } catch (error) {
      toast({
        title: 'Could not schedule transfer',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelScheduled.mutateAsync(id);
      toast({ title: 'Scheduled transfer cancelled', variant: 'success' });
    } catch (error) {
      toast({
        title: 'Could not cancel',
        description: error instanceof ApiClientError ? error.message : undefined,
        variant: 'destructive',
      });
    }
  }

  const pending = (scheduledTransfers ?? []).filter((s) => s.status === 'SCHEDULED');
  const others = (scheduledTransfers ?? []).filter((s) => s.status !== 'SCHEDULED');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Schedule a transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="scheduleTransferType">Send</Label>
              <Select
                defaultValue="INTERNAL"
                onValueChange={(value) =>
                  form.setValue('transferType', value as ScheduleForm['transferType'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="scheduleTransferType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNAL">Between my accounts</SelectItem>
                  <SelectItem value="EXTERNAL">To a beneficiary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scheduleSourceAccountId">From</Label>
              <Select
                onValueChange={(value) =>
                  form.setValue('sourceAccountId', value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="scheduleSourceAccountId">
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountTypeCode.replace(/_/g, ' ')} — {account.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.sourceAccountId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sourceAccountId.message}
                </p>
              )}
            </div>

            {transferType === 'INTERNAL' ? (
              <div className="grid gap-2">
                <Label htmlFor="scheduleDestinationAccountId">To</Label>
                <Select
                  onValueChange={(value) =>
                    form.setValue('destinationAccountId', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="scheduleDestinationAccountId">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== sourceAccountId)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountTypeCode.replace(/_/g, ' ')} — {account.accountNumber}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.destinationAccountId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.destinationAccountId.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="scheduleBeneficiaryId">To</Label>
                <Select
                  onValueChange={(value) =>
                    form.setValue('beneficiaryId', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="scheduleBeneficiaryId">
                    <SelectValue placeholder="Select beneficiary" />
                  </SelectTrigger>
                  <SelectContent>
                    {verifiedBeneficiaries.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nickname ? `${b.nickname} (${b.beneficiaryName})` : b.beneficiaryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.beneficiaryId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.beneficiaryId.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="scheduleAmount">
                Amount{sourceAccount ? ` (${sourceAccount.currencyCode})` : ''}
              </Label>
              <Input
                id="scheduleAmount"
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('amount')}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="scheduleFrequency">Frequency</Label>
                <Select
                  defaultValue="ONE_TIME"
                  onValueChange={(value) =>
                    form.setValue('frequency', value as ScheduleForm['frequency'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="scheduleFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduleStartAt">
                  {frequency === 'ONE_TIME' ? 'Send on' : 'Starting'}
                </Label>
                <Input id="scheduleStartAt" type="datetime-local" {...form.register('startAt')} />
                {form.formState.errors.startAt && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.startAt.message}
                  </p>
                )}
              </div>
            </div>

            {frequency !== 'ONE_TIME' && (
              <div className="grid gap-2">
                <Label htmlFor="scheduleEndDate">Ends on (optional)</Label>
                <Input id="scheduleEndDate" type="datetime-local" {...form.register('endDate')} />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="scheduleDescription">Note (optional)</Label>
              <Input
                id="scheduleDescription"
                placeholder="e.g. Rent"
                {...form.register('description')}
              />
            </div>

            <Button type="submit" className="w-full" loading={createScheduled.isPending}>
              <CalendarClock className="h-4 w-4" /> Schedule transfer
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-16" />
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending scheduled transfers.</p>
          ) : (
            pending.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {s.description ??
                      (s.transferType === 'INTERNAL'
                        ? 'Transfer between accounts'
                        : `To ${s.beneficiaryName}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCY_LABELS[s.frequency]} · Next {formatDateTime(s.nextRunAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatMoney(s.amount, s.currencyCode)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancel(s.id)}
                    aria-label="Cancel scheduled transfer"
                  >
                    <Ban className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {others.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {s.description ??
                      (s.transferType === 'INTERNAL'
                        ? 'Transfer between accounts'
                        : `To ${s.beneficiaryName}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCY_LABELS[s.frequency]}
                    {s.failureReason ? ` · ${s.failureReason}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatMoney(s.amount, s.currencyCode)}</span>
                  <Badge
                    variant={
                      s.status === 'COMPLETED'
                        ? 'success'
                        : s.status === 'FAILED'
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecentTransfers({ accountIds }: { accountIds: string[] }) {
  // Recent-transfers preview reuses the first active account's transaction
  // history (already includes both legs of any transfer touching it) rather
  // than a dedicated cross-account endpoint — see TransfersController's doc
  // comment on why transfer history isn't duplicated as its own endpoint.
  const firstAccountId = accountIds[0];
  const { data: transactions } = useAccountTransactions(firstAccountId);
  const transfers = (transactions ?? []).filter((t) => t.transactionType.startsWith('TRANSFER'));

  if (!firstAccountId || transfers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transfers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {transfers.slice(0, 10).map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
          >
            <div>
              <p className="font-medium text-foreground">{t.description ?? 'Transfer'}</p>
              <p className="text-xs text-muted-foreground">
                {t.transactionReference} · {formatDateTime(t.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatMoney(t.amount, t.currencyCode)}</span>
              <StatusBadge status={t.status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

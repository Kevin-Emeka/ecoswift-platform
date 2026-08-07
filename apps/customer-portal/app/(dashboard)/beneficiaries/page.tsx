'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Star, ShieldCheck, Trash2 } from 'lucide-react';
import {
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
  Skeleton,
  cn,
  useToast,
} from '@ecoswift/ui';
import {
  useBeneficiaries,
  useCreateBeneficiary,
  useUpdateBeneficiary,
  useVerifyBeneficiary,
  useDeleteBeneficiary,
} from '../../../lib/hooks/use-beneficiaries';
import { ApiClientError } from '../../../lib/api/http-client';

const beneficiarySchema = z.object({
  beneficiaryName: z.string().min(1, 'Required').max(120),
  accountNumber: z.string().min(4, 'Enter a valid account number').max(34),
  bankName: z.string().max(120).optional(),
  bankCode: z.string().max(20).optional(),
  currencyCode: z.string().length(3, 'Use a 3-letter code (e.g. USD)'),
  nickname: z.string().max(60).optional(),
});

type BeneficiaryForm = z.infer<typeof beneficiarySchema>;

export default function BeneficiariesPage() {
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const { data: beneficiaries, isLoading } = useBeneficiaries(search || undefined);
  const createBeneficiary = useCreateBeneficiary();
  const updateBeneficiary = useUpdateBeneficiary();
  const verifyBeneficiary = useVerifyBeneficiary();
  const deleteBeneficiary = useDeleteBeneficiary();
  const { toast } = useToast();

  const form = useForm<BeneficiaryForm>({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: { beneficiaryName: '', accountNumber: '', bankName: '', bankCode: '', currencyCode: 'USD', nickname: '' },
  });

  async function onSubmit(values: BeneficiaryForm) {
    try {
      await createBeneficiary.mutateAsync(values);
      toast({ title: 'Beneficiary added', description: 'Verify it before sending money.', variant: 'success' });
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: 'Could not add beneficiary',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function toggleFavorite(beneficiaryId: string, isFavorite: boolean) {
    try {
      await updateBeneficiary.mutateAsync({ beneficiaryId, input: { isFavorite: !isFavorite } });
    } catch (error) {
      toast({ title: 'Could not update beneficiary', variant: 'destructive' });
    }
  }

  async function handleVerify(beneficiaryId: string) {
    try {
      await verifyBeneficiary.mutateAsync(beneficiaryId);
      toast({ title: 'Beneficiary verified', variant: 'success' });
    } catch (error) {
      toast({
        title: 'Could not verify beneficiary',
        description: error instanceof ApiClientError ? error.message : undefined,
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(beneficiaryId: string) {
    try {
      await deleteBeneficiary.mutateAsync(beneficiaryId);
      toast({ title: 'Beneficiary removed', variant: 'success' });
    } catch (error) {
      toast({ title: 'Could not remove beneficiary', variant: 'destructive' });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Beneficiaries</h1>
          <p className="text-muted-foreground">People and accounts you send money to.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add beneficiary
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Add a beneficiary</DialogTitle>
                <DialogDescription>Save their details so you can send to them again later.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="beneficiaryName">Full name</Label>
                  <Input id="beneficiaryName" {...form.register('beneficiaryName')} />
                  {form.formState.errors.beneficiaryName && (
                    <p className="text-xs text-destructive">{form.formState.errors.beneficiaryName.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accountNumber">Account number</Label>
                  <Input id="accountNumber" {...form.register('accountNumber')} />
                  {form.formState.errors.accountNumber && (
                    <p className="text-xs text-destructive">{form.formState.errors.accountNumber.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bankName">Bank name (optional)</Label>
                    <Input id="bankName" {...form.register('bankName')} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currencyCode">Currency</Label>
                    <Input id="currencyCode" placeholder="USD" {...form.register('currencyCode')} />
                    {form.formState.errors.currencyCode && (
                      <p className="text-xs text-destructive">{form.formState.errors.currencyCode.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nickname">Nickname (optional)</Label>
                  <Input id="nickname" placeholder="e.g. Mom" {...form.register('nickname')} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" loading={form.formState.isSubmitting}>
                  Add beneficiary
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search beneficiaries…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : beneficiaries && beneficiaries.length > 0 ? (
        <div className="space-y-3">
          {beneficiaries.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(b.id, b.isFavorite)}
                    aria-label={b.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                    className="text-muted-foreground hover:text-warning"
                  >
                    <Star className={cn('h-5 w-5', b.isFavorite && 'fill-warning text-warning')} />
                  </button>
                  <div>
                    <p className="font-medium text-foreground">
                      {b.nickname ? `${b.nickname} (${b.beneficiaryName})` : b.beneficiaryName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {b.accountNumber}
                      {b.bankName ? ` · ${b.bankName}` : ''} · {b.currencyCode}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.status === 'ACTIVE' ? (
                    <Badge variant="success">Verified</Badge>
                  ) : b.status === 'BLOCKED' ? (
                    <Badge variant="destructive">Blocked</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleVerify(b.id)} loading={verifyBeneficiary.isPending}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Verify
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(b.id)} aria-label="Remove beneficiary">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {search ? `No beneficiaries match "${search}".` : "You haven't added any beneficiaries yet."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

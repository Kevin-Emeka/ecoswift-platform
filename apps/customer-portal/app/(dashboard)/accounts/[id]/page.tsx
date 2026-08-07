'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Download, FileText } from 'lucide-react';
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
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@ecoswift/ui';
import { useAccount, useAccountTransactions, useActivateAccount, useDeposit, useWithdraw } from '../../../../lib/hooks/use-accounts';
import { useRequestStatement, useStatements } from '../../../../lib/hooks/use-statements';
import { useAuth } from '../../../../lib/auth/auth-context';
import { getReceiptDownloadUrl } from '../../../../lib/api/receipts';
import { getStatementDownloadUrl } from '../../../../lib/api/statements';
import { downloadAuthenticated } from '../../../../lib/api/download';
import { formatMoney, formatDateTime } from '../../../../lib/format';
import { ApiClientError } from '../../../../lib/api/http-client';

function TransactionDialog({
  accountId,
  mode,
  trigger,
}: {
  accountId: string;
  mode: 'deposit' | 'withdraw';
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const deposit = useDeposit(accountId);
  const withdraw = useWithdraw(accountId);
  const { toast } = useToast();
  const mutation = mode === 'deposit' ? deposit : withdraw;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({ amount: Number(amount), description: description || undefined });
      toast({ title: mode === 'deposit' ? 'Deposit simulated' : 'Withdrawal simulated', variant: 'success' });
      setOpen(false);
      setAmount('');
      setDescription('');
    } catch (error) {
      toast({
        title: 'Transaction failed',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === 'deposit' ? 'Make a deposit' : 'Make a withdrawal'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;
  const { accessToken } = useAuth();
  const { data: account, isLoading } = useAccount(accountId);
  const { data: transactions, isLoading: isLoadingTx } = useAccountTransactions(accountId);
  const activate = useActivateAccount();
  const { toast } = useToast();

  async function handleDownloadReceipt(transactionId: string, reference: string) {
    try {
      await downloadAuthenticated(getReceiptDownloadUrl(transactionId), accessToken!, `receipt-${reference}.pdf`);
    } catch (error) {
      toast({
        title: 'Could not download receipt',
        description: error instanceof ApiClientError ? error.message : undefined,
        variant: 'destructive',
      });
    }
  }

  async function handleActivate() {
    try {
      await activate.mutateAsync(accountId);
      toast({ title: 'Account activated', variant: 'success' });
    } catch (error) {
      toast({ title: 'Could not activate', description: error instanceof ApiClientError ? error.message : undefined, variant: 'destructive' });
    }
  }

  if (isLoading || !account) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{account.accountTypeCode.replace(/_/g, ' ')}</h1>
          <p className="text-muted-foreground">Account number {account.accountNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={account.status} />
          <Badge variant="outline">{account.currencyCode}</Badge>
        </div>
      </div>

      {account.status === 'PENDING_ACTIVATION' && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>This account is pending activation.</span>
            <Button size="sm" onClick={handleActivate} loading={activate.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Activate now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatMoney(account.availableBalance, account.currencyCode)}</p>
          <p className="text-sm text-muted-foreground">Available balance</p>
          {account.openingJournalNumber && (
            <p className="mt-2 text-xs text-muted-foreground">Opening journal: {account.openingJournalNumber}</p>
          )}
        </CardContent>
        {account.status === 'ACTIVE' && (
          <CardContent className="flex flex-wrap gap-3 pt-0">
            <TransactionDialog
              accountId={accountId}
              mode="deposit"
              trigger={
                <Button variant="secondary">
                  <ArrowDownToLine className="h-4 w-4" /> Deposit
                </Button>
              }
            />
            <TransactionDialog
              accountId={accountId}
              mode="withdraw"
              trigger={
                <Button variant="secondary">
                  <ArrowUpFromLine className="h-4 w-4" /> Withdraw
                </Button>
              }
            />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTx ? (
            <Skeleton className="h-40" />
          ) : transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs">{tx.transactionReference}</TableCell>
                    <TableCell>{tx.transactionType}</TableCell>
                    <TableCell>{formatMoney(tx.amount, tx.currencyCode)}</TableCell>
                    <TableCell>
                      <StatusBadge status={tx.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(tx.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {tx.status === 'COMPLETED' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Download receipt"
                          onClick={() => handleDownloadReceipt(tx.id, tx.transactionReference)}
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          )}
        </CardContent>
      </Card>

      <StatementsCard accountId={accountId} />
    </div>
  );
}

function StatementsCard({ accountId }: { accountId: string }) {
  const { accessToken } = useAuth();
  const { data: allStatements, isLoading } = useStatements();
  const requestStatement = useRequestStatement();
  const { toast } = useToast();

  const statements = (allStatements ?? []).filter((s) => s.accountId === accountId);

  const [periodStart, setPeriodStart] = React.useState('');
  const [periodEnd, setPeriodEnd] = React.useState('');
  const [format, setFormat] = React.useState<'PDF' | 'CSV'>('PDF');

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    try {
      await requestStatement.mutateAsync({ accountId, input: { periodStart, periodEnd, format } });
      toast({ title: 'Statement requested', description: "We'll let you know when it's ready to download.", variant: 'success' });
      setPeriodStart('');
      setPeriodEnd('');
    } catch (error) {
      toast({
        title: 'Could not request statement',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleDownload(statementId: string, statementFormat: string) {
    try {
      await downloadAuthenticated(
        getStatementDownloadUrl(statementId),
        accessToken!,
        `statement.${statementFormat.toLowerCase()}`,
      );
    } catch (error) {
      toast({
        title: 'Could not download statement',
        description: error instanceof ApiClientError ? error.message : undefined,
        variant: 'destructive',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleRequest} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="periodStart">From</Label>
            <Input id="periodStart" type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="periodEnd">To</Label>
            <Input id="periodEnd" type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="statementFormat">Format</Label>
            <Select defaultValue="PDF" onValueChange={(value) => setFormat(value as 'PDF' | 'CSV')}>
              <SelectTrigger id="statementFormat" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" loading={requestStatement.isPending}>
            <FileText className="h-4 w-4" /> Request statement
          </Button>
        </form>

        {isLoading ? (
          <Skeleton className="h-16" />
        ) : statements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No statements requested yet.</p>
        ) : (
          <div className="space-y-3">
            {statements.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.format}</p>
                </div>
                {s.status === 'COMPLETED' && s.statementId ? (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(s.statementId!, s.format)}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                ) : (
                  <StatusBadge status={s.status} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

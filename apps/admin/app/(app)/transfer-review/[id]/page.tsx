'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Check, X } from 'lucide-react';
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
import { useAuth } from '../../../../lib/auth/auth-context';
import { useApproveTransferReview, useRejectTransferReview, useTransferReview } from '../../../../lib/hooks/use-transfer-review';
import { formatMoney, formatDateTime } from '../../../../lib/format';
import { ApiClientError } from '../../../../lib/api/http-client';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function TransferReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const transactionId = params.id;
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const { data: review, isLoading, isError, error, refetch } = useTransferReview(transactionId);
  const approve = useApproveTransferReview(transactionId);
  const reject = useRejectTransferReview(transactionId);

  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [comments, setComments] = React.useState('');
  const [reason, setReason] = React.useState('');

  async function handleApprove() {
    try {
      await approve.mutateAsync(comments || undefined);
      toast({ title: 'Transfer approved', description: 'It has been posted to the ledger.', variant: 'success' });
      setApproveOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: 'Could not approve this transfer',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      toast({ title: 'A reason is required', variant: 'destructive' });
      return;
    }
    try {
      await reject.mutateAsync(reason);
      toast({ title: 'Transfer rejected', description: 'The customer has been notified.', variant: 'success' });
      setRejectOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: 'Could not reject this transfer',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !review) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load this held transfer.'}</AlertDescription>
      </Alert>
    );
  }

  const isPending = review.approvalStatus === 'PENDING';
  const canApprove = hasPermission('transactions:approve');
  const canReject = hasPermission('transactions:reject');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button onClick={() => router.push('/transfer-review')} className="text-sm text-muted-foreground hover:underline">
            &larr; Back to review queue
          </button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{review.transactionReference}</h1>
          <p className="text-muted-foreground">{review.customerName} &middot; {review.customerEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={review.approvalStatus} />
          <Badge variant="outline">{review.transferChannel.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfer details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-3xl font-bold">{formatMoney(review.amount, review.currencyCode)}</p>
          <DetailRow label="From" value={review.sourceAccountNumber} />
          <DetailRow label="To" value={review.destinationLabel} />
          {review.description && <DetailRow label="Description" value={review.description} />}
          <DetailRow label="Held since" value={formatDateTime(review.heldAt)} />
          {review.resolvedAt && <DetailRow label="Resolved" value={formatDateTime(review.resolvedAt)} />}
          {review.checkerName && <DetailRow label="Reviewed by" value={review.checkerName} />}
          {review.comments && <DetailRow label="Notes" value={review.comments} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this was held</CardTitle>
        </CardHeader>
        <CardContent>
          {review.fraudSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fraud signals were recorded for this hold.</p>
          ) : (
            <div className="space-y-2">
              {review.fraudSignals.map((signal, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="text-sm">
                    <p className="font-medium">{signal.signalType.replace(/_/g, ' ')}</p>
                    {signal.reason && <p className="text-muted-foreground">{signal.reason}</p>}
                    <p className="text-xs text-muted-foreground">Score {signal.score.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isPending && (canApprove || canReject) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {canApprove && (
              <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve this transfer</DialogTitle>
                    <DialogDescription>
                      This posts the transfer to the ledger through the same workflow a normal transfer takes and notifies
                      the customer.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2 py-4">
                    <Label htmlFor="comments">Notes (optional)</Label>
                    <Input id="comments" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Add context for the audit trail" />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleApprove} loading={approve.isPending}>
                      Approve transfer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {canReject && (
              <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject this transfer</DialogTitle>
                    <DialogDescription>No funds will move. The customer will be notified with your reason.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2 py-4">
                    <Label htmlFor="reason">Reason</Label>
                    <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being declined?" required />
                  </div>
                  <DialogFooter>
                    <Button variant="destructive" onClick={handleReject} loading={reject.isPending}>
                      Reject transfer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

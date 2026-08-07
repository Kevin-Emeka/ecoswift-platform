'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
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
} from '@ecoswift/ui';
import { useTransferReviews } from '../../../lib/hooks/use-transfer-review';
import { formatMoney, formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';
import type { TransferReviewStatus } from '../../../lib/api/transfer-review';

const STATUS_OPTIONS: TransferReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export default function TransferReviewPage() {
  const [status, setStatus] = React.useState<TransferReviewStatus>('PENDING');
  const { data, isLoading, isError, error } = useTransferReviews(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transfer Review</h1>
        <p className="text-muted-foreground">
          Transfers held for manual review — no funds move until a decision is made here.
        </p>
      </div>

      <Select value={status} onValueChange={(value) => setStatus(value as TransferReviewStatus)}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option === 'PENDING' ? 'Awaiting review' : option.charAt(0) + option.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load held transfers.'}</AlertDescription>
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
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Held since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/transfer-review/${item.id}`} className="block font-medium hover:underline">
                        {item.transactionReference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.sourceAccountNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{item.destinationLabel}</TableCell>
                    <TableCell>{formatMoney(item.amount, item.currencyCode)}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.approvalStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(item.heldAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {status === 'PENDING' ? 'Nothing is waiting for review.' : `No ${status.toLowerCase()} transfers.`}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

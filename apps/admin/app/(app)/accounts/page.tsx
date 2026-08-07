'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  Input,
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
import { Pagination } from '../../../components/pagination';
import { useStaffAccounts } from '../../../lib/hooks/use-accounts';
import { formatMoney, formatDate } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

const STATUS_OPTIONS = ['ALL', 'PENDING_ACTIVATION', 'ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED', 'RESTRICTED'];

export default function AccountsPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('ALL');
  const limit = 20;

  const { data, isLoading, isError, error } = useStaffAccounts({
    page,
    limit,
    search: search || undefined,
    status: status === 'ALL' ? undefined : status,
  });

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
        <p className="text-muted-foreground">Browse and search every account across all customers.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by account number" className="pl-9" value={search} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'ALL' ? 'All statuses' : option.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load accounts.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : data && data.items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Link href={`/accounts/${account.id}`} className="block font-medium hover:underline">
                        {account.accountNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{account.customerNumber}</TableCell>
                    <TableCell>{account.accountTypeCode.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{formatMoney(account.availableBalance, account.currencyCode)}</TableCell>
                    <TableCell>
                      <StatusBadge status={account.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(account.openedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No accounts match your filters.</CardContent>
        </Card>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
    </div>
  );
}

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
import { useCustomers } from '../../../lib/hooks/use-customers';
import { formatDate } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'INACTIVE', 'DEACTIVATED'];

export default function CustomersPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('ALL');
  const limit = 20;

  const { data, isLoading, isError, error } = useCustomers({
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
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">Browse and search every customer across the bank.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or number"
            className="pl-9"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'ALL' ? 'All statuses' : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load customers.'}</AlertDescription>
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((customer) => (
                  <TableRow key={customer.customerId} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/customers/${customer.customerId}`} className="block font-medium hover:underline">
                        {customer.fullName}
                      </Link>
                      <span className="text-xs text-muted-foreground">{customer.customerNumber}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                    <TableCell>{customer.tier.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <StatusBadge status={customer.status} />
                    </TableCell>
                    <TableCell>{customer.accountCount}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(customer.dateJoined)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No customers match your filters.</CardContent>
        </Card>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
    </div>
  );
}

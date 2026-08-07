'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, AlertDescription, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton, StatusBadge } from '@ecoswift/ui';
import { useCustomer } from '../../../../lib/hooks/use-customers';
import { formatDate } from '../../../../lib/format';
import { ApiClientError } from '../../../../lib/api/http-client';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '—'}</p>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const { data: customer, isLoading, isError, error } = useCustomer(customerId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load this customer.'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.firstName} {customer.middleName ? `${customer.middleName} ` : ''}
            {customer.lastName}
          </h1>
          <p className="text-muted-foreground">Customer number {customer.customerNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={customer.status} />
          <Badge variant="outline">{customer.tier.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date of birth" value={formatDate(customer.dateOfBirth)} />
          <Field label="Gender" value={customer.gender} />
          <Field label="Occupation" value={customer.occupation} />
          <Field label="Preferred language" value={customer.preferredLanguage} />
          <Field label="Preferred currency" value={customer.preferredCurrencyCode} />
          <Field label="Timezone" value={customer.timezone} />
          <Field label="Profile completion" value={customer.profileCompletionStatus} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Address line 1" value={customer.addressLine1} />
          <Field label="Address line 2" value={customer.addressLine2} />
          <Field label="City" value={customer.city} />
          <Field label="State" value={customer.state} />
          <Field label="Postal code" value={customer.postalCode} />
          <Field label="Country" value={customer.addressCountryCode} />
        </CardContent>
      </Card>

      {customer.missingFields.length > 0 && (
        <Alert variant="warning">
          <AlertDescription>Missing profile fields: {customer.missingFields.join(', ')}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertDescription>
          This customer&apos;s accounts and sessions aren&apos;t directly linked from this view — the customer profile endpoint doesn&apos;t
          expose a <code>userId</code>, and the staff accounts list can only be searched by account number, not customer id. Use the{' '}
          <Link href="/accounts" className="font-medium text-primary hover:underline">
            Accounts
          </Link>{' '}
          screen and search by account number if you know it.
        </AlertDescription>
      </Alert>
    </div>
  );
}

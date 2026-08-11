'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
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
  useToast,
} from '@ecoswift/ui';
import { useProfile, useUpdateProfile } from '../../../lib/hooks/use-profile';
import { listCountries, listCurrencies } from '../../../lib/api/reference-data';
import { ApiClientError } from '../../../lib/api/http-client';

// Loaded client-side only — see the identical note on the register/transfers
// pages' Combobox import: this is a first-use RSC/webpack module-id issue,
// not a real coupling requirement.
const Combobox = dynamic(() => import('@ecoswift/ui').then((mod) => mod.Combobox), { ssr: false });

export default function ProfilePage() {
  const { data: profile, isLoading, isError, error, refetch, isRefetching } = useProfile();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const { data: currencies } = useQuery({ queryKey: ['currencies'], queryFn: listCurrencies });
  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: listCountries });
  const countryOptions = React.useMemo(
    () => (countries ?? []).map((c) => ({ value: c.isoCode, label: c.name, keywords: c.isoCode })),
    [countries],
  );

  const [form, setForm] = React.useState({
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    addressCountryCode: '',
    occupation: '',
    timezone: '',
    preferredCurrencyId: '',
  });

  React.useEffect(() => {
    if (profile) {
      // The profile GET only returns the currency's ISO code, not its id
      // (which is what the update endpoint needs) — resolve it against the
      // fetched currency list once both are available.
      const matchingCurrencyId =
        currencies?.find((c) => c.isoCode === profile.preferredCurrencyCode)?.id ?? '';
      setForm({
        addressLine1: profile.addressLine1 ?? '',
        addressLine2: profile.addressLine2 ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        postalCode: profile.postalCode ?? '',
        addressCountryCode: profile.addressCountryCode ?? '',
        occupation: profile.occupation ?? '',
        timezone: profile.timezone ?? '',
        preferredCurrencyId: matchingCurrencyId,
      });
    }
  }, [profile, currencies]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      // Omit blank optional fields rather than sending '' — addressCountryCode
      // (and any future field validated with @Length/@Matches rather than
      // just @IsString) rejects an empty string as an invalid value, even
      // though the field is optional when left out entirely.
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
      await updateProfile.mutateAsync(payload);
      toast({ title: 'Profile updated', variant: 'success' });
    } catch (error) {
      toast({
        title: 'Could not update profile',
        description: error instanceof ApiClientError ? error.message : undefined,
        variant: 'destructive',
      });
    }
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">Manage your personal information.</p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof ApiClientError
              ? error.message
              : "Couldn't load your profile. This is usually temporary — please try again."}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => refetch()} loading={isRefetching}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your personal information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Customer number {profile.customerNumber}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">
              {profile.firstName} {profile.lastName}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Tier</p>
            <Badge variant="outline">{profile.tier}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Profile completion</p>
            <Badge variant={profile.profileCompletionStatus === 'COMPLETE' ? 'success' : 'warning'}>
              {profile.profileCompletionStatus}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update your details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input
                id="addressLine1"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input
                id="addressLine2"
                value={form.addressLine2}
                onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addressCountryCode">Country</Label>
                <Combobox
                  id="addressCountryCode"
                  options={countryOptions}
                  value={form.addressCountryCode}
                  onChange={(value) => setForm({ ...form, addressCountryCode: value })}
                  placeholder="Select country"
                  searchPlaceholder="Search countries…"
                  emptyMessage="No country found."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="e.g. America/New_York"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="preferredCurrencyId">Preferred currency</Label>
              <Select
                value={form.preferredCurrencyId}
                onValueChange={(value) => setForm({ ...form, preferredCurrencyId: value })}
              >
                <SelectTrigger id="preferredCurrencyId">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {(currencies ?? []).map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.isoCode} — {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" loading={updateProfile.isPending}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

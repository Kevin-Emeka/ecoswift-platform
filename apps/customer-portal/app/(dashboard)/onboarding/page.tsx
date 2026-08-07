'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
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
  useToast,
} from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { useConsents, useRecordConsent, useUpdateProfile } from '../../../lib/hooks/use-profile';
import { listCurrencies } from '../../../lib/api/reference-data';
import { ApiClientError } from '../../../lib/api/http-client';

const TERMS_VERSION = '2026-01-01';
const PRIVACY_VERSION = '2026-01-01';

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: consents } = useConsents();
  const recordConsent = useRecordConsent();
  const updateProfile = useUpdateProfile();
  const { data: currencies } = useQuery({ queryKey: ['currencies'], queryFn: listCurrencies });

  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = React.useState(false);
  const [marketingOptIn, setMarketingOptIn] = React.useState(false);
  const [step, setStep] = React.useState<'consent' | 'profile'>('consent');

  const [addressLine1, setAddressLine1] = React.useState('');
  const [city, setCity] = React.useState('');
  const [addressCountryCode, setAddressCountryCode] = React.useState('');
  const [occupation, setOccupation] = React.useState('');
  const [preferredCurrencyId, setPreferredCurrencyId] = React.useState('');

  const hasAcceptedMandatory = consents?.some((c) => c.consentType === 'TERMS_AND_CONDITIONS' && c.accepted) &&
    consents?.some((c) => c.consentType === 'PRIVACY_POLICY' && c.accepted);

  React.useEffect(() => {
    if (hasAcceptedMandatory) setStep('profile');
  }, [hasAcceptedMandatory]);

  async function handleAcceptConsents() {
    if (!acceptedTerms || !acceptedPrivacy) return;
    try {
      await recordConsent.mutateAsync({ consentType: 'TERMS_AND_CONDITIONS', version: TERMS_VERSION, accepted: true });
      await recordConsent.mutateAsync({ consentType: 'PRIVACY_POLICY', version: PRIVACY_VERSION, accepted: true });
      if (marketingOptIn) {
        await recordConsent.mutateAsync({ consentType: 'MARKETING_COMMUNICATIONS', version: '1.0', accepted: true });
      }
      setStep('profile');
    } catch (error) {
      toast({ title: 'Could not save your choices', description: error instanceof ApiClientError ? error.message : undefined, variant: 'destructive' });
    }
  }

  async function handleCompleteProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({ addressLine1, city, addressCountryCode, occupation, preferredCurrencyId });
      toast({ title: 'Profile completed', variant: 'success' });
      router.push('/dashboard');
    } catch (error) {
      toast({ title: 'Could not save profile', description: error instanceof ApiClientError ? error.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome to {BRANDING.brandName}</h1>
        <p className="text-muted-foreground">A couple of quick steps before your checking account is ready to use.</p>
      </div>

      {step === 'consent' ? (
        <Card>
          <CardHeader>
            <CardTitle>Terms &amp; Privacy</CardTitle>
            <CardDescription>Please review and accept to continue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary underline">
                  Terms of Service
                </a>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
              <span>
                I agree to the{' '}
                <a href="/privacy" target="_blank" className="text-primary underline">
                  Privacy Policy
                </a>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
              <span>Send me product updates and offers (optional)</span>
            </label>
            <Button
              className="w-full"
              disabled={!acceptedTerms || !acceptedPrivacy}
              loading={recordConsent.isPending}
              onClick={handleAcceptConsents}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Complete your profile</CardTitle>
            <CardDescription>This helps us personalize your experience.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompleteProfile} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="addressLine1">Address</Label>
                <Input id="addressLine1" required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addressCountryCode">Country code</Label>
                  <Input
                    id="addressCountryCode"
                    required
                    maxLength={2}
                    placeholder="US"
                    value={addressCountryCode}
                    onChange={(e) => setAddressCountryCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="occupation">Occupation</Label>
                <Input id="occupation" required value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="preferredCurrencyId">Preferred currency</Label>
                <Select onValueChange={setPreferredCurrencyId}>
                  <SelectTrigger id="preferredCurrencyId">
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies?.map((currency) => (
                      <SelectItem key={currency.id} value={currency.id}>
                        {currency.isoCode} — {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" loading={updateProfile.isPending}>
                <CheckCircle2 className="h-4 w-4" /> Finish setup
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertDescription>You can always update these details later from Profile &amp; Settings.</AlertDescription>
      </Alert>
    </div>
  );
}

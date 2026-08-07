'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCircle2, ChevronLeft, Mail } from 'lucide-react';
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
  Progress,
  cn,
} from '@ecoswift/ui';

// Loaded client-side only: this is the only place in either app that pulls in
// cmdk/Popover, and letting it flow through the server-rendered RSC payload
// hits a webpack module-id bug ("Cannot read properties of undefined
// (reading 'call')") the very first time that chunk combination is
// referenced. Deferring it to a pure client import sidesteps that entirely.
const Combobox = dynamic(() => import('@ecoswift/ui').then((mod) => mod.Combobox), { ssr: false });
import * as authApi from '../../../lib/api/auth';
import { listCountries } from '../../../lib/api/reference-data';
import { ApiClientError } from '../../../lib/api/http-client';

const registerSchema = z.object({
  firstName: z.string().min(1, 'Required').regex(/^[\p{L} '-]+$/u, 'Letters only'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Required').regex(/^[\p{L} '-]+$/u, 'Letters only'),
  dateOfBirth: z.string().min(1, 'Required'),
  countryId: z.string().uuid('Select your country'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(12, 'At least 12 characters'),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
});

type RegisterForm = z.infer<typeof registerSchema>;

const STEP_FIELDS: Record<number, (keyof RegisterForm)[]> = {
  0: ['firstName', 'lastName', 'dateOfBirth', 'countryId'],
  1: ['email', 'password'],
  2: ['acceptedTerms'],
};

const STEPS = ['About you', 'Account access', 'Review & confirm'];

function passwordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 20, label: 'Weak', color: 'bg-destructive' };
  if (score === 2) return { score: 45, label: 'Fair', color: 'bg-warning' };
  if (score === 3) return { score: 70, label: 'Good', color: 'bg-brand-accent' };
  return { score: 100, label: 'Strong', color: 'bg-success' };
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: listCountries });

  const form = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), mode: 'onTouched' });
  const password = form.watch('password') ?? '';
  const strength = passwordStrength(password);
  const countryId = form.watch('countryId');

  // Default to United States once the country list has loaded, but only if
  // the field is still empty — never override a country the user already
  // picked (e.g. by navigating back to this step).
  const defaultedRef = React.useRef(false);
  React.useEffect(() => {
    if (defaultedRef.current || !countries || countries.length === 0) return;
    const unitedStates = countries.find((c) => c.isoCode === 'US');
    if (unitedStates && !form.getValues('countryId')) {
      form.setValue('countryId', unitedStates.id);
    }
    defaultedRef.current = true;
  }, [countries, form]);

  const countryOptions = React.useMemo(
    () => (countries ?? []).map((c) => ({ value: c.id, label: c.name, keywords: c.isoCode })),
    [countries],
  );

  async function goNext() {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(values: RegisterForm) {
    setServerError(null);
    try {
      const { acceptedTerms: _acceptedTerms, ...payload } = values;
      await authApi.register(payload);
      setSuccess(true);
    } catch (error) {
      setServerError(error instanceof ApiClientError ? error.message : 'Registration failed. Please try again.');
    }
  }

  if (success) {
    return (
      <Card className="animate-in">
        <CardHeader className="items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <Mail className="h-6 w-6 text-success" />
          </span>
          <CardTitle className="mt-3">You&apos;re almost there</CardTitle>
          <CardDescription>We&apos;ve sent a verification link to activate your checking account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const values = form.getValues();
  const selectedCountry = countries?.find((c) => c.id === values.countryId);

  return (
    <Card className="animate-in">
      <CardHeader>
        <CardTitle className="text-2xl">Open a checking account</CardTitle>
        <CardDescription>Step {step + 1} of {STEPS.length} — {STEPS[step]}</CardDescription>
        <Progress value={((step + 1) / STEPS.length) * 100} className="mt-3" />
        <div className="mt-3 flex justify-between">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={cn(
                'flex items-center gap-1.5 text-[11px] font-medium',
                i <= step ? 'text-brand-accent' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
                  i < step ? 'bg-success text-white' : i === step ? 'bg-brand-accent text-white' : 'bg-muted',
                )}
              >
                {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {step === 0 && (
            <div className="animate-in space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" invalid={!!form.formState.errors.firstName} {...form.register('firstName')} />
                  {form.formState.errors.firstName && <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" invalid={!!form.formState.errors.lastName} {...form.register('lastName')} />
                  {form.formState.errors.lastName && <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="middleName">Middle name (optional)</Label>
                <Input id="middleName" {...form.register('middleName')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input id="dateOfBirth" type="date" invalid={!!form.formState.errors.dateOfBirth} {...form.register('dateOfBirth')} />
                {form.formState.errors.dateOfBirth && <p className="text-xs text-destructive">{form.formState.errors.dateOfBirth.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="countryId">Country</Label>
                <Combobox
                  id="countryId"
                  options={countryOptions}
                  value={countryId}
                  onChange={(value) => form.setValue('countryId', value, { shouldValidate: true })}
                  placeholder="Select your country"
                  searchPlaceholder="Search countries…"
                  emptyMessage="No country found."
                  invalid={!!form.formState.errors.countryId}
                />
                {form.formState.errors.countryId && <p className="text-xs text-destructive">{form.formState.errors.countryId.message}</p>}
              </div>
              <Button type="button" className="w-full" onClick={goNext}>
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" invalid={!!form.formState.errors.email} {...form.register('email')} placeholder="you@example.com" />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" invalid={!!form.formState.errors.password} {...form.register('password')} />
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300', strength.color)}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Password strength: {strength.label}</p>
                  </div>
                )}
                {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="button" className="flex-1" onClick={goNext}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in space-y-4">
              <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium text-foreground">
                    {values.firstName} {values.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-foreground">{values.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Country</span>
                  <span className="font-medium text-foreground">{selectedCountry?.name ?? '—'}</span>
                </div>
              </div>
              <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input accent-[#2563EB]"
                  {...form.register('acceptedTerms')}
                />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" className="font-medium text-brand-accent hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="font-medium text-brand-accent hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {form.formState.errors.acceptedTerms && (
                <p className="text-xs text-destructive">{form.formState.errors.acceptedTerms.message}</p>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="submit" className="flex-1" loading={form.formState.isSubmitting} onClick={() => router.prefetch('/login')}>
                  <CheckCircle2 className="h-4 w-4" /> Open my account
                </Button>
              </div>
            </div>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-accent hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

import Link from 'next/link';
import { Building2, Check, Rocket, Sparkles } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';

const TIERS = [
  {
    name: 'Starter',
    icon: Rocket,
    price: 'Free',
    period: '',
    description: 'For individuals exploring personal banking flows.',
    features: ['Savings & Current accounts', 'Deposits & withdrawals', 'MFA & device trust', 'Standard transaction history'],
    cta: { label: 'Open an account', href: '/register' },
    variant: 'outline' as const,
    highlighted: false,
  },
  {
    name: 'Professional',
    icon: Sparkles,
    price: 'Free',
    period: '',
    description: 'For teams testing business banking and multi-account setups.',
    features: [
      'Everything in Starter',
      'Business & Fixed Deposit accounts',
      'Multiple linked accounts per user',
      'Audit-log visibility on your own activity',
      'Priority-labeled notifications',
    ],
    cta: { label: 'Open an account', href: '/register' },
    variant: 'gradient' as const,
    highlighted: true,
  },
  {
    name: 'Enterprise',
    icon: Building2,
    price: 'Contact us',
    period: '',
    description: 'For organizations that want a guided walkthrough or custom setup.',
    features: ['Everything in Professional', 'Dedicated onboarding walkthrough', 'Admin & compliance tooling demo', 'Priority support access'],
    cta: { label: 'Contact sales', href: '/contact' },
    variant: 'outline' as const,
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-brand-radial py-20 text-center text-white md:py-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <Badge variant="brand" className="border-white/20 bg-white/10 text-white">
            Pricing
          </Badge>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">Simple, illustrative pricing</h1>
          <p className="mt-6 text-lg text-white/70">
            {BRANDING.brandName} is a demonstration platform, so every tier below is free to use. The tiers exist
            to illustrate how a real product&apos;s pricing page might be structured.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 md:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              className={tier.highlighted ? 'card-lift relative border-2 border-brand-accent shadow-premium-lg md:-translate-y-3' : 'card-lift'}
            >
              <CardHeader>
                {tier.highlighted && (
                  <Badge variant="brand" className="mb-2 w-fit">
                    Most popular
                  </Badge>
                )}
                <span
                  className={
                    tier.highlighted
                      ? 'flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white'
                      : 'flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent'
                  }
                >
                  <tier.icon className="h-5 w-5" />
                </span>
                <CardTitle className="mt-4 text-2xl">{tier.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">{tier.price}</span>
                  {tier.period && <span className="text-sm text-muted-foreground">/ {tier.period}</span>}
                </div>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button size="lg" variant={tier.variant} className="w-full" asChild>
                  <Link href={tier.cta.href}>{tier.cta.label}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-muted-foreground">
          These tiers are an illustrative pricing structure for the {BRANDING.brandName} demo platform — they do
          not represent real commercial pricing, and no payment is ever collected.
        </p>
      </section>
    </>
  );
}

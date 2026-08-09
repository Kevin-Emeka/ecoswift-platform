import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Braces,
  Briefcase,
  Building2,
  Check,
  Cpu,
  Fingerprint,
  GraduationCap,
  KeyRound,
  Landmark,
  LifeBuoy,
  Lock,
  PiggyBank,
  ScanFace,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { SkylineSilhouette } from '../../components/marketing/skyline-silhouette';

const STAT_STRIP = [
  { value: '$0', label: 'Monthly account fees' },
  { value: '256-bit', label: 'End-to-end encryption' },
  { value: '<5 min', label: 'Average account opening time' },
  { value: '99.9%', label: 'Platform uptime target' },
];

const TRUST_BADGES = [
  { icon: ShieldCheck, label: 'Bank-grade Security' },
  { icon: LifeBuoy, label: '24/7 Support' },
  { icon: Zap, label: '99.9% Availability' },
];

const FEATURES = [
  {
    icon: Wallet,
    title: 'Open an account in minutes',
    description:
      'Savings, Current, Fixed Deposit, or Business accounts — get a real account number and start exploring instantly.',
  },
  {
    icon: Landmark,
    title: 'Real double-entry ledger',
    description:
      'Every balance is backed by an actual, balanced accounting ledger — the same model production banking platforms use.',
  },
  {
    icon: Lock,
    title: 'Enterprise-grade security',
    description:
      'Multi-factor authentication, device trust, session management, and full audit trails protect every account.',
  },
  {
    icon: Sparkles,
    title: 'Modern, accessible design',
    description:
      'A fast, responsive dashboard with dark mode, keyboard navigation, and thoughtful loading states throughout.',
  },
];

const ACCOUNT_TYPES = [
  {
    href: '/account-types#checking',
    icon: Wallet,
    name: 'Personal Checking',
    blurb: 'Everyday spending, zero monthly fees.',
  },
  {
    href: '/account-types#savings',
    icon: PiggyBank,
    name: 'Savings',
    blurb: 'Automated, goal-based saving.',
  },
  {
    href: '/account-types#business',
    icon: Briefcase,
    name: 'Business',
    blurb: 'Built for growing companies.',
  },
  {
    href: '/account-types#student',
    icon: GraduationCap,
    name: 'Student',
    blurb: 'Banking for the next chapter.',
  },
  {
    href: '/account-types#joint',
    icon: Building2,
    name: 'Joint',
    blurb: 'Shared accounts, shared goals.',
  },
];

const SECURITY_POINTS = [
  {
    icon: Fingerprint,
    title: 'Multi-factor authentication',
    description: 'TOTP, backup codes, and step-up verification for sensitive actions.',
  },
  {
    icon: ScanFace,
    title: 'Device trust & session control',
    description:
      'Every sign-in is fingerprinted; revoke any device from your dashboard in one tap.',
  },
  {
    icon: KeyRound,
    title: 'Hashed credentials, always',
    description: 'Passwords are never stored in plain text — industry-standard hashing throughout.',
  },
  {
    icon: ShieldCheck,
    title: 'Full audit trail',
    description: 'Every account action is logged in a tamper-evident, hash-chained audit ledger.',
  },
];

const TECH_POINTS = [
  {
    icon: Cpu,
    title: 'Real-time ledger processing',
    description: 'Balances update instantly against a genuine double-entry accounting core.',
  },
  {
    icon: Braces,
    title: 'API-first infrastructure',
    description:
      'Every dashboard action runs through the same versioned REST APIs available to developers.',
  },
  {
    icon: Zap,
    title: 'Event-driven architecture',
    description:
      'Notifications, receipts, and audit logs are generated asynchronously via a message-queue backbone.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'The account-opening flow feels like a production bank, not a demo. Watching the ledger update in real time after a simulated deposit sold me immediately.',
    name: 'Operations Lead',
    role: 'Fintech Startup',
  },
  {
    quote:
      'Clean API, clear audit trail, sensible permission model. Exactly what I want to evaluate before wiring a real integration.',
    name: 'Platform Engineer',
    role: 'Payments Infrastructure Team',
  },
  {
    quote:
      'The security posture — MFA, device trust, session revocation — is more thorough than most live products I use.',
    name: 'Security Reviewer',
    role: 'Independent Consultant',
  },
];

const PRICING_TEASER = [
  {
    name: 'Starter',
    price: '$0',
    description: 'For individuals exploring the platform.',
    featured: false,
  },
  {
    name: 'Professional',
    price: '$29',
    description: 'For businesses that need more from their account.',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For institutions with dedicated requirements.',
    featured: false,
  },
];

const FAQ_TEASER = [
  {
    q: 'Is this a real, licensed bank?',
    a: `${BRANDING.brandName} is a demonstration project built to showcase modern banking UX and architecture — it isn't a chartered or licensed financial institution. See our Terms of Service for details.`,
  },
  {
    q: 'Can I open more than one account?',
    a: 'Yes — open as many accounts as you like across Checking, Savings, Business, Student, and Joint account types.',
  },
  {
    q: 'How do transactions work?',
    a: 'Deposits and withdrawals post through a real double-entry ledger, the same accounting model production banking platforms use.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-brand-radial text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
          aria-hidden="true"
        />
        <SkylineSilhouette className="pointer-events-none absolute inset-x-0 bottom-0 h-[280px] w-full opacity-30 md:h-[360px]" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[280px] bg-gradient-to-t from-[#0B1F4D] via-[#0B1F4D]/70 to-transparent md:h-[360px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-400/20 blur-[120px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-24 md:px-6 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="brand" className="border-white/20 bg-white/10 text-white">
              Smart Digital Banking Platform
            </Badge>
            <h1 className="mt-6 font-heading text-4xl font-extrabold tracking-tight md:text-6xl md:leading-[1.08]">
              Banking Built{' '}
              <span className="bg-gradient-to-r from-blue-300 to-white bg-clip-text text-transparent">
                Around You.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/70">
              Modern checking accounts, powerful digital banking, and enterprise-grade security
              designed for everyday life.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="gradient"
                asChild
                className="bg-white text-primary hover:brightness-95"
              >
                <Link href="/register">
                  Open a Checking Account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/product">Explore Products</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-2 text-sm font-medium text-white/80"
                >
                  <badge.icon className="h-4 w-4 text-brand-accent" /> {badge.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {STAT_STRIP.map((stat) => (
              <div
                key={stat.label}
                className="glass-dark rounded-bank-md border border-white/10 p-5 text-center"
              >
                <p className="font-heading text-2xl font-extrabold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-xs text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Trust strip */}
      <section className="border-b border-border bg-muted/30 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 text-sm font-medium text-muted-foreground md:px-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-accent" /> Bank-grade encryption
          </span>
          <span className="inline-flex items-center gap-2">
            <Landmark className="h-4 w-4 text-brand-accent" /> Real double-entry ledger
          </span>
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand-accent" /> MFA on every account
          </span>
          <span className="inline-flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-accent" /> Real-time processing
          </span>
        </div>
      </section>

      {/* 3. Features */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Platform
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Everything a modern bank needs
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built on a production-oriented architecture from the ground up.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <feature.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
                About {BRANDING.brandName}
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                A modern banking platform, built end to end
              </h2>
              <p className="mt-4 text-muted-foreground">
                {BRANDING.brandName} was built to show what a modern digital bank looks like end to
                end — from the moment someone registers to the moment they review a transaction
                receipt, backed by a real double-entry ledger and the same security model production
                banking platforms use.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3 md:grid-cols-1">
              {[
                { value: 'Real ledger', label: 'Double-entry accounting under every balance' },
                { value: 'Bank-grade', label: 'MFA, device trust, and full audit trails' },
                {
                  value: 'End-to-end',
                  label: 'Register through transaction history, fully working',
                },
              ].map((stat) => (
                <div
                  key={stat.value}
                  className="rounded-2xl border border-border bg-card p-5 shadow-premium"
                >
                  <dt className="text-xl font-bold tracking-tight text-brand-accent">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 4. Account types */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
                Account types
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                One platform, every account you need
              </h2>
            </div>
            <Button variant="outline" asChild>
              <Link href="/account-types">
                Compare all accounts <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {ACCOUNT_TYPES.map((account) => (
              <Link key={account.name} href={account.href}>
                <Card className="card-lift h-full">
                  <CardContent className="p-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                      <account.icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 font-semibold text-foreground">{account.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{account.blurb}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Security */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-14 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
                Security
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                Security that meets enterprise expectations
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every layer of the platform — authentication, sessions, data, and audit — is
                designed the way a production financial system has to be.
              </p>
              <Button variant="outline" className="mt-8" asChild>
                <Link href="/resources/security-center">
                  Visit the Security Center <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {SECURITY_POINTS.map((point) => (
                <div
                  key={point.title}
                  className="rounded-2xl border border-border bg-card p-5 shadow-premium"
                >
                  <point.icon className="h-6 w-6 text-brand-accent" />
                  <p className="mt-3 text-sm font-semibold text-foreground">{point.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Mobile / anywhere banking */}
      <section className="border-t border-border bg-primary py-24 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 md:grid-cols-2 md:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Bank anywhere
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              A fully responsive experience, on any device
            </h2>
            <p className="mt-4 text-white/70">
              The dashboard, account opening, and every transaction work the same on your phone,
              tablet, or desktop — no separate app to install.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                'Open accounts and transact from any browser',
                'Real-time balance and transaction updates',
                'Dark mode and accessible by default',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/85">
                  <Check className="h-4 w-4 shrink-0 text-brand-accent" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-xs">
            <div className="glass-dark rounded-[2.5rem] border border-white/10 p-3 shadow-premium-lg">
              <div className="rounded-[2rem] bg-primary/60 p-5">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <Smartphone className="h-4 w-4" />
                  <span>9:41</span>
                </div>
                <p className="mt-6 text-xs text-white/60">Available balance</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">$12,480.55</p>
                <Badge variant="brand" className="mt-3 border-white/20 bg-white/10 text-white">
                  Checking account
                </Badge>
                <div className="mt-6 space-y-2">
                  {[
                    ['Deposit', '+ $500.00'],
                    ['Transfer', '- $120.40'],
                  ].map(([label, amount]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-sm"
                    >
                      <span className="text-white/80">{label}</span>
                      <span className="font-medium">{amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Bank-grade technology */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Technology
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Bank-grade technology underneath
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TECH_POINTS.map((point) => (
              <Card key={point.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <point.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{point.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">
                    {point.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Testimonials */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Feedback
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              What people say while exploring the platform
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="card-lift flex flex-col justify-between">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 text-warning">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-foreground">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                      {t.name.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Pricing teaser */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Pricing
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Simple, transparent pricing
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PRICING_TEASER.map((tier) => (
              <Card
                key={tier.name}
                className={
                  tier.featured
                    ? 'card-lift border-2 border-brand-accent shadow-premium-lg'
                    : 'card-lift'
                }
              >
                <CardHeader>
                  {tier.featured && (
                    <Badge variant="brand" className="mb-2 w-fit">
                      Most popular
                    </Badge>
                  )}
                  <CardTitle>{tier.name}</CardTitle>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                    {tier.price}
                  </p>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button variant="outline" asChild>
              <Link href="/pricing">
                See full plan comparison <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 10. FAQ teaser */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">FAQ</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-10 space-y-3">
            {FAQ_TEASER.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-8 text-center">
            <Button variant="outline" asChild>
              <Link href="/faq">
                View all questions <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="relative overflow-hidden bg-brand-gradient py-24 text-center text-white">
        <div className="relative mx-auto max-w-2xl px-4 md:px-6">
          <Banknote className="mx-auto h-10 w-10 text-white/70" />
          <h2 className="mt-6 font-heading text-3xl font-bold tracking-tight md:text-4xl">
            Ready to try it out?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Create an account and see the full journey — from registration to your first
            transaction.
          </p>
          <Button size="lg" className="mt-8 bg-white text-primary hover:brightness-95" asChild>
            <Link href="/register">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BadgeCheck,
  Building2,
  Code2,
  FileText,
  Fingerprint,
  Landmark,
  Repeat,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';

const PRODUCTS = [
  {
    id: 'payments',
    icon: Repeat,
    title: 'Payments',
    description:
      'Simulated deposits and withdrawals post through a real double-entry ledger, with validation, posting, and receipt generation identical in shape to a production payments flow.',
  },
  {
    id: 'transfers',
    icon: BadgeCheck,
    title: 'Transfers',
    description:
      'Move funds between accounts with clear references, timestamps, and running balances — every movement is traceable end to end in the ledger.',
  },
  {
    id: 'virtual-accounts',
    icon: Building2,
    title: 'Virtual Accounts',
    description:
      'Open Savings, Current, Fixed Deposit, or Business accounts in minutes. Each is issued a properly formatted, unique account number, exactly as a production banking core would generate.',
  },
  {
    id: 'statements',
    icon: FileText,
    title: 'Statements',
    description:
      'Every transaction produces a structured receipt, and full transaction history is available on demand — reconciled against the same ledger that backs your balance.',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    description:
      'Welcome emails, verification links, login alerts, and account activity are delivered through an asynchronous, queue-backed notification pipeline.',
  },
  {
    id: 'developer-apis',
    icon: Code2,
    title: 'Developer APIs',
    description:
      'Every action in the product runs through the same versioned, documented REST APIs available to developers — explore live Swagger docs on every service.',
  },
];

const CAPABILITIES = [
  {
    icon: Wallet,
    title: 'Account opening & real account numbers',
    description:
      'Open Savings, Current, Fixed Deposit, or Business accounts in minutes. Each account is issued a properly formatted, unique account number, just like a production banking system would generate.',
  },
  {
    icon: Landmark,
    title: 'Double-entry ledger balances',
    description:
      'Every balance shown in the dashboard is derived from an actual, balanced double-entry accounting ledger — the same bookkeeping model used by real banking cores — so figures always reconcile.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise-grade security',
    description:
      'Multi-factor authentication, device trust and recognition, active session management, and full audit trails protect every account, mirroring the controls a real financial institution would run.',
  },
  {
    icon: Fingerprint,
    title: 'Admin & compliance tooling',
    description:
      'Behind the scenes, an admin console provides detailed audit logs, granular role and permission management, and compliance-oriented reporting for reviewing platform activity.',
  },
];

export default function ProductPage() {
  return (
    <>
      <section className="bg-brand-radial py-20 text-white md:py-28">
        <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
          <Badge variant="brand" className="border-white/20 bg-white/10 text-white">
            Smart Digital Banking Platform
          </Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">The platform, end to end</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
            {BRANDING.brandName} is a full-stack digital banking platform, built to look, feel, and behave like a
            real banking product architecturally — from account opening to a real double-entry ledger underneath
            every balance.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="gradient" asChild className="bg-white text-primary hover:brightness-95">
              <Link href="/register">
                Open an account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-white/25 bg-white/5 text-white hover:bg-white/10">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">Product</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Six pillars, one platform</h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((product) => (
              <Card key={product.id} id={product.id} className="card-lift scroll-mt-24">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <product.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{product.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{product.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Platform capabilities</h2>
            <p className="mt-4 text-muted-foreground">A production-oriented architecture, built from the ground up.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {CAPABILITIES.map((capability) => (
              <Card key={capability.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <capability.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{capability.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{capability.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 md:px-6">
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-xl">A note on what this is</CardTitle>
            <CardDescription className="text-[15px] leading-relaxed text-foreground/80">
              {BRANDING.brandName} is a demonstration and testing environment only. Account balances, deposits, withdrawals, and
              transfers are simulated for evaluation and development purposes. No real currency is processed, no funds are
              custodied, and the platform is not connected to any real banking network, payment rail, or financial institution.
              Nothing on this site should be treated as a real financial service or financial advice.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="relative overflow-hidden bg-brand-gradient py-24 text-center text-white">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">See it for yourself</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/70">
          Create an account and walk through the full journey — from registration to your first transaction.
        </p>
        <Button size="lg" className="mt-8 bg-white text-primary hover:brightness-95" asChild>
          <Link href="/register">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </>
  );
}

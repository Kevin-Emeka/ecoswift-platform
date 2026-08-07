import Link from 'next/link';
import { ArrowRight, Briefcase, Building2, Check, GraduationCap, Minus, PiggyBank, Sparkles, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';

const ACCOUNT_TYPES = [
  {
    id: 'checking',
    icon: Wallet,
    name: 'Personal Checking',
    tagline: 'Everyday spending, zero monthly fees.',
    bestFor: 'Day-to-day spending and bill pay.',
  },
  {
    id: 'savings',
    icon: PiggyBank,
    name: 'Savings',
    tagline: 'Grow your balance automatically.',
    bestFor: 'Building an emergency fund or saving goal.',
  },
  {
    id: 'business',
    icon: Briefcase,
    name: 'Business',
    tagline: 'Built for growing companies.',
    bestFor: 'Freelancers, startups, and small businesses.',
  },
  {
    id: 'student',
    icon: GraduationCap,
    name: 'Student',
    tagline: 'Banking for the next chapter.',
    bestFor: 'Students building their first financial habits.',
  },
  {
    id: 'joint',
    icon: Building2,
    name: 'Joint',
    tagline: 'Shared accounts, shared goals.',
    bestFor: 'Couples, families, and shared expenses.',
  },
];

type Cell = boolean | string;

const COMPARISON: { feature: string; values: Cell[] }[] = [
  { feature: 'Monthly fee', values: ['$0', '$0', '$0', '$0', '$0'] },
  { feature: 'Minimum opening balance', values: ['$0', '$0', '$0', '$0', '$0'] },
  { feature: 'Interest-bearing', values: [false, true, false, false, true] },
  { feature: 'Multiple account owners', values: [false, false, true, false, true] },
  { feature: 'Deposits & withdrawals', values: [true, true, true, true, true] },
  { feature: 'Real-time ledger balance', values: [true, true, true, true, true] },
  { feature: 'Transaction history & receipts', values: [true, true, true, true, true] },
];

function ComparisonCell({ value }: { value: Cell }) {
  if (typeof value === 'string') return <span className="font-medium text-foreground">{value}</span>;
  return value ? <Check className="mx-auto h-4 w-4 text-success" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />;
}

export default function AccountTypesPage() {
  return (
    <>
      <section className="bg-brand-radial py-20 text-center text-white md:py-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <Badge variant="brand" className="border-white/20 bg-white/10 text-white">
            Account types
          </Badge>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">One platform, every account you need</h1>
          <p className="mt-6 text-lg text-white/70">
            Every account type runs on the same real double-entry ledger — open as many as you like with{' '}
            {BRANDING.brandName}.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ACCOUNT_TYPES.map((account) => (
              <Card key={account.id} id={account.id} className="card-lift scroll-mt-24">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <account.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{account.name}</CardTitle>
                  <CardDescription className="text-[15px]">{account.tagline}</CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Best for: <span className="font-medium text-foreground">{account.bestFor}</span>
                  </p>
                </CardHeader>
              </Card>
            ))}
            <Card className="card-lift flex flex-col justify-center border-dashed">
              <CardHeader>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Sparkles className="h-6 w-6" />
                </span>
                <CardTitle className="mt-4">Future products</CardTitle>
                <CardDescription className="text-[15px]">
                  More account types — including Fixed Deposit — are on the platform&apos;s roadmap.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">Compare</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Every account, side by side</h2>
          </div>

          <Card className="mt-12 overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[200px]">Feature</TableHead>
                  {ACCOUNT_TYPES.map((a) => (
                    <TableHead key={a.id} className="text-center">
                      {a.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell className="font-medium text-foreground">{row.feature}</TableCell>
                    {row.values.map((value, i) => (
                      <TableCell key={ACCOUNT_TYPES[i]?.id ?? i} className="text-center">
                        <ComparisonCell value={value} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>

      <section className="relative overflow-hidden bg-brand-gradient py-24 text-center text-white">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Open your account</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/70">Choose an account type and be issued a real account number in minutes.</p>
        <Button size="lg" className="mt-8 bg-white text-primary hover:brightness-95" asChild>
          <Link href="/register">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </>
  );
}

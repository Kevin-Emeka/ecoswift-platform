import { Users, Code2, ShieldCheck, Palette, LineChart } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const DISCIPLINES = [
  { icon: Code2, title: 'Engineering', description: 'Owns the ledger core, service architecture, and API surface.' },
  { icon: ShieldCheck, title: 'Security & Compliance', description: 'Owns authentication, audit trails, and platform integrity.' },
  { icon: Palette, title: 'Product & Design', description: 'Owns the customer and admin experience, end to end.' },
  { icon: LineChart, title: 'Platform Operations', description: 'Owns reliability, observability, and the deployment pipeline.' },
];

export default function LeadershipPage() {
  return (
    <>
      <PageHero
        eyebrow="Leadership"
        icon={Users}
        title="The team behind the platform"
        description={`${BRANDING.brandName} is organized around a small set of disciplines, each responsible for one part of the platform.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {DISCIPLINES.map((d) => (
              <Card key={d.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <d.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{d.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{d.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-muted-foreground">
            {BRANDING.brandName} is a demonstration platform — this page describes how responsibility is organized across
            the product rather than naming specific individuals.
          </p>
        </div>
      </section>
    </>
  );
}

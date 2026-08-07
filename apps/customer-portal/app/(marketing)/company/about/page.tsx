import { Building2, Landmark, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const PILLARS = [
  {
    icon: Landmark,
    title: 'Production-grade architecture',
    description: 'A real double-entry ledger, versioned APIs, and event-driven services — the same patterns a live bank runs on.',
  },
  {
    icon: ShieldCheck,
    title: 'Security-first design',
    description: 'MFA, device trust, session management, and a tamper-evident audit trail are built in from day one, not bolted on.',
  },
  {
    icon: Sparkles,
    title: 'A safe place to explore',
    description: 'A fully working platform, free to test and explore without any real-world risk.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        icon={Building2}
        title={`About ${BRANDING.brandName}`}
        description="A full-stack digital banking demonstration, built to show what a modern, enterprise-grade bank looks like end to end."
      />

      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <p className="text-lg leading-relaxed text-muted-foreground">
            {BRANDING.brandName} was built to answer a simple question: what does a modern digital bank actually look like,
            from the first click of registration to a reconciled ledger entry? Rather than mocking up static screens, we
            built the real thing — a working account-opening flow, a genuine double-entry accounting core, enterprise
            authentication, and an internal admin console — so it&apos;s safe to explore, demo, and build against.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Nothing here touches a real banking network. No real funds are ever held, moved, or custodied. Every simulated
            transaction is clearly labeled as such, in the product and in every API response.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <Card key={pillar.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <pillar.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{pillar.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{pillar.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

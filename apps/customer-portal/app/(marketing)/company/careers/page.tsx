import { Briefcase, Code2, ShieldCheck, Palette, Server } from 'lucide-react';
import { Badge, Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const ROLE_CATEGORIES = [
  { icon: Code2, title: 'Engineering', description: 'Backend services, ledger systems, and API design.' },
  { icon: Palette, title: 'Product & Design', description: 'Customer and admin experience across the platform.' },
  { icon: ShieldCheck, title: 'Security & Compliance', description: 'Authentication, audit, and platform integrity.' },
  { icon: Server, title: 'Platform & Infrastructure', description: 'Reliability, deployment, and observability.' },
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        eyebrow="Careers"
        icon={Briefcase}
        title="Help us build the future of banking"
        description="This is an illustrative careers page for a demonstration platform — not an active job board."
      />

      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
          <Badge variant="warning">Not currently hiring</Badge>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            {BRANDING.brandName} is a demonstration platform, so this page illustrates what a careers page might look like
            rather than listing real open roles. No applications are collected here.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">Illustrative role categories</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Where a team like this would grow</h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {ROLE_CATEGORIES.map((role) => (
              <Card key={role.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <role.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{role.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{role.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

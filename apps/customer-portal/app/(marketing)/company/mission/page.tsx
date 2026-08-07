import { Target, Users, Code2, GraduationCap } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const AUDIENCES = [
  { icon: Code2, title: 'Engineers', description: 'A realistic backend to integrate against, complete with versioned APIs and Swagger docs.' },
  { icon: Users, title: 'Product & design teams', description: 'A working reference for what enterprise banking UX should feel like.' },
  { icon: GraduationCap, title: 'Students & learners', description: 'A hands-on way to see how ledgers, auth, and compliance tooling fit together.' },
];

export default function MissionPage() {
  return (
    <>
      <PageHero
        eyebrow="Mission"
        icon={Target}
        title="Why we built this"
        description={`${BRANDING.brandName} exists to make modern banking architecture tangible — not a slide deck, a working product.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
          <p className="text-xl font-medium leading-relaxed text-foreground">
            &ldquo;Show, don&apos;t just describe, what a production-grade digital bank actually looks like — end to end,
            safely, and without a single real dollar at risk.&rdquo;
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">Who it&apos;s for</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Built for people who build things</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <Card key={a.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <a.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{a.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{a.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

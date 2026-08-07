import { Handshake, Database, Layers, Lock, Server } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const TECHNOLOGY = [
  { icon: Database, title: 'PostgreSQL', description: 'The relational datastore backing the double-entry ledger and every domain service.' },
  { icon: Layers, title: 'NestJS & Next.js', description: 'The service framework and frontend framework powering the platform.' },
  { icon: Server, title: 'Redis & BullMQ', description: 'Caching, rate limiting, and the asynchronous job queue behind notifications and receipts.' },
  { icon: Lock, title: 'Industry-standard cryptography', description: 'Password hashing, JWT-based sessions, and TOTP multi-factor authentication.' },
];

export default function PartnersPage() {
  return (
    <>
      <PageHero
        eyebrow="Partners"
        icon={Handshake}
        title="Who we build alongside"
        description={`${BRANDING.brandName} is built on established, open technology — here's what powers it under the hood.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {TECHNOLOGY.map((tech) => (
              <Card key={tech.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <tech.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{tech.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{tech.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-muted-foreground">
            {BRANDING.brandName} does not have real commercial banking, card network, or payment-rail partnerships — it is
            not connected to any real financial infrastructure.
          </p>
        </div>
      </section>
    </>
  );
}

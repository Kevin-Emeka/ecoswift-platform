import Link from 'next/link';
import { ArrowRight, LifeBuoy, UserPlus, Landmark, ShieldCheck, MessageCircle } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const TOPICS = [
  { icon: UserPlus, title: 'Getting started', description: 'Registering, verifying your email, and opening your first account.', href: '/faq' },
  { icon: Landmark, title: 'Accounts & transactions', description: 'Balances, simulated deposits & withdrawals, and transaction history.', href: '/faq' },
  { icon: ShieldCheck, title: 'Security & access', description: 'Multi-factor authentication, sessions, and device management.', href: '/faq' },
  { icon: MessageCircle, title: 'Contact support', description: 'Reach the team directly for anything not covered here.', href: '/contact' },
];

export default function HelpCenterPage() {
  return (
    <>
      <PageHero
        eyebrow="Help Center"
        icon={LifeBuoy}
        title="How can we help?"
        description={`Browse common topics about ${BRANDING.brandName}, or search the full FAQ.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {TOPICS.map((topic) => (
              <Link key={topic.title} href={topic.href}>
                <Card className="card-lift h-full">
                  <CardHeader>
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                      <topic.icon className="h-6 w-6" />
                    </span>
                    <div className="mt-4 flex items-center justify-between">
                      <CardTitle>{topic.title}</CardTitle>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardDescription className="text-[15px] leading-relaxed">{topic.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

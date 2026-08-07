import Link from 'next/link';
import { ArrowRight, FileCode, KeyRound, Landmark, Bell, Receipt } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const GUIDES = [
  { icon: KeyRound, title: 'Authentication', description: 'Registration, email verification, login, MFA, and session management.' },
  { icon: Landmark, title: 'Accounts & transactions', description: 'Opening accounts, checking balances, and simulating deposits & withdrawals.' },
  { icon: Bell, title: 'Notifications', description: 'How platform events become emails, SMS, and in-app notifications.' },
  { icon: Receipt, title: 'Receipts', description: 'How every simulated transaction generates a structured, retrievable receipt.' },
];

export default function DocumentationPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        icon={FileCode}
        title="Guides for using the platform"
        description={`Everything you need to integrate with or explore ${BRANDING.brandName}.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <Card key={guide.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <guide.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{guide.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{guide.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="mt-10">
            <CardHeader>
              <CardTitle>Looking for API-level detail?</CardTitle>
              <CardDescription>Visit the Developer API page for live, versioned reference documentation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/resources/developer-api">
                  Go to Developer API <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

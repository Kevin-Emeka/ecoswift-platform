import { ShieldCheck, Fingerprint, ScanFace, KeyRound, ScrollText, Lock } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const CONTROLS = [
  { icon: Fingerprint, title: 'Multi-factor authentication', description: 'TOTP-based MFA with backup codes and step-up verification for sensitive actions.' },
  { icon: ScanFace, title: 'Device trust & recognition', description: 'Every sign-in is fingerprinted by device; revoke any device from your security settings.' },
  { icon: KeyRound, title: 'Hashed credentials', description: 'Passwords are hashed with industry-standard algorithms — never stored or logged in plain text.' },
  { icon: ScrollText, title: 'Tamper-evident audit trail', description: 'Every account action is recorded in a hash-chained audit log that detects tampering.' },
  { icon: Lock, title: 'Encrypted in transit', description: 'All traffic between the client, services, and database is encrypted end to end.' },
  { icon: ShieldCheck, title: 'Session management', description: 'View and revoke active sessions at any time from your account security page.' },
];

export default function SecurityCenterPage() {
  return (
    <>
      <PageHero
        eyebrow="Security Center"
        icon={ShieldCheck}
        title="How we protect your account"
        description={`Every layer of ${BRANDING.brandName} — authentication, sessions, data, and audit — is designed the way a production financial system has to be.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((control) => (
              <Card key={control.title} className="card-lift">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <control.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="mt-4">{control.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{control.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center text-sm text-muted-foreground md:px-6">
          Found a security issue? Contact us at{' '}
          <a href={`mailto:${BRANDING.emails.security}`} className="font-medium text-brand-accent hover:underline">
            {BRANDING.emails.security}
          </a>
          .
        </div>
      </section>
    </>
  );
}

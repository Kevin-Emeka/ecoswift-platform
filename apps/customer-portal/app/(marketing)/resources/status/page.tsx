import { Activity, CheckCircle2 } from 'lucide-react';
import { Badge, Card, CardContent } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const SERVICES = [
  'Auth Service',
  'Account Service',
  'Notification Service',
  'Receipt Service',
  'Customer Portal',
  'Admin Console',
];

export default function StatusPage() {
  return (
    <>
      <PageHero
        eyebrow="Status"
        icon={Activity}
        title="Platform status"
        description="An illustrative status page — not backed by live, continuous uptime monitoring."
      />

      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <p className="font-semibold text-foreground">All services operational</p>
              </div>
              <Badge variant="success">Operational</Badge>
            </CardContent>
          </Card>

          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-premium">
            {SERVICES.map((service) => (
              <div key={service} className="flex items-center justify-between px-6 py-4">
                <span className="text-sm font-medium text-foreground">{service}</span>
                <Badge variant="success">Operational</Badge>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">
            This page illustrates what a production status page would look like and is not backed by live incident
            or uptime monitoring.
          </p>
        </div>
      </section>
    </>
  );
}

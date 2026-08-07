import { Code2, ExternalLink } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const SERVICES = [
  { name: 'Auth Service', description: 'Registration, login, MFA, sessions, devices.', docsPath: '/api/docs' },
  { name: 'Account Service', description: 'Accounts, deposits & withdrawals, staff tooling.', docsPath: '/api/docs' },
  { name: 'Notification Service', description: 'In-app notifications and delivery status.', docsPath: '/api/docs' },
  { name: 'Receipt Service', description: 'Transaction receipts and retrieval.', docsPath: '/api/docs' },
];

export default function DeveloperApiPage() {
  return (
    <>
      <PageHero
        eyebrow="Developer API"
        icon={Code2}
        title="Build on the same APIs we use"
        description="Every action in the product runs through these same versioned, documented REST APIs."
      />

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {SERVICES.map((service) => (
              <Card key={service.name} className="card-lift">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <Badge variant="brand">REST · v1</Badge>
                  </div>
                  <CardDescription className="text-[15px] leading-relaxed">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" disabled>
                    View Swagger docs <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-muted-foreground">
            Live Swagger documentation is served directly by each running {BRANDING.brandName} service in a local or
            deployed environment — this page is a directory of what&apos;s available, not a hosted copy.
          </p>
        </div>
      </section>
    </>
  );
}

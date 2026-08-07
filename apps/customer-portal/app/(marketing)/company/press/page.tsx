import { Newspaper, Mail, Download } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

export default function PressPage() {
  return (
    <>
      <PageHero
        eyebrow="Press"
        icon={Newspaper}
        title="Media & press"
        description={`Background information and brand assets for anyone writing about the ${BRANDING.brandName} demonstration platform.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="card-lift">
              <CardHeader>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                  <Download className="h-6 w-6" />
                </span>
                <CardTitle className="mt-4">Brand assets</CardTitle>
                <CardDescription className="text-[15px]">Logo, color palette, and boilerplate description for reference.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Brand kit — illustrative placeholder for a demonstration platform.
                </div>
              </CardContent>
            </Card>
            <Card className="card-lift">
              <CardHeader>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                  <Mail className="h-6 w-6" />
                </span>
                <CardTitle className="mt-4">Media inquiries</CardTitle>
                <CardDescription className="text-[15px]">Reach the team directly with any questions.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <a href={`mailto:${BRANDING.emails.support}`}>{BRANDING.emails.support}</a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mx-auto mt-12 max-w-2xl text-center">
            <Badge variant="brand">Boilerplate</Badge>
            <p className="mt-4 text-muted-foreground">
              {BRANDING.brandName} is a demonstration of a modern digital banking platform — a working account-opening
              flow, a real double-entry ledger, and enterprise-grade security controls, built to show what production banking
              infrastructure looks like end to end.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

import { Newspaper, Landmark, ShieldCheck, Zap } from 'lucide-react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { PageHero } from '../../../../components/marketing/page-hero';

const POSTS = [
  {
    icon: Landmark,
    tag: 'Architecture',
    title: 'Why we built a real double-entry ledger from day one',
    excerpt:
      'Most demo platforms fake balances with a single number in a database. We built an actual double-entry accounting core instead — here\'s why that matters.',
  },
  {
    icon: ShieldCheck,
    tag: 'Security',
    title: 'Inside the security model: MFA, device trust, and audit trails',
    excerpt: 'A look at how authentication, session management, and tamper-evident audit logging fit together across the platform.',
  },
  {
    icon: Zap,
    tag: 'Platform',
    title: 'How notifications, receipts, and audit logs stay in sync',
    excerpt: 'An event-driven, queue-backed architecture keeps every side effect of a transaction consistent — without slowing down the request.',
  },
];

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        icon={Newspaper}
        title="Product news and platform insights"
        description={`Notes on how ${BRANDING.brandName} is built, from the engineering team.`}
      />

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {POSTS.map((post) => (
              <Card key={post.title} className="card-lift flex flex-col">
                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                    <post.icon className="h-6 w-6" />
                  </span>
                  <Badge variant="brand" className="mt-4 w-fit">
                    {post.tag}
                  </Badge>
                  <CardTitle className="mt-3 text-lg leading-snug">{post.title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">{post.excerpt}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <span className="text-sm font-medium text-muted-foreground">Coming soon</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

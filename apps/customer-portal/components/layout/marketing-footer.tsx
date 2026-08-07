import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Separator } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';

const FOOTER_COLUMNS: Record<string, { href: string; label: string }[]> = {
  Products: [
    { href: '/product', label: 'Overview' },
    { href: '/account-types', label: 'Account Types' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/product#developer-apis', label: 'Developer APIs' },
  ],
  Resources: [
    { href: '/resources/blog', label: 'Blog' },
    { href: '/resources/documentation', label: 'Documentation' },
    { href: '/resources/developer-api', label: 'Developer API' },
    { href: '/resources/security-center', label: 'Security Center' },
    { href: '/resources/help-center', label: 'Help Center' },
    { href: '/resources/status', label: 'Status Page' },
  ],
  Company: [
    { href: '/company/about', label: 'About' },
    { href: '/company/mission', label: 'Mission' },
    { href: '/company/leadership', label: 'Leadership' },
    { href: '/company/careers', label: 'Careers' },
    { href: '/company/press', label: 'Press' },
    { href: '/company/partners', label: 'Partners' },
  ],
  Support: [
    { href: '/contact', label: 'Contact' },
    { href: '/faq', label: 'FAQ' },
    { href: '/resources/help-center', label: 'Help Center' },
  ],
  Legal: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-extrabold">
                {BRANDING.shortName.slice(0, 2)}
              </span>
              {BRANDING.brandName}
            </Link>
            <p className="mt-3 max-w-[220px] text-sm text-primary-foreground/70">{BRANDING.tagline}</p>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-primary-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-accent" />
              Bank-grade security
            </div>
          </div>

          {Object.entries(FOOTER_COLUMNS).map(([section, links]) => (
            <div key={section}>
              <p className="text-sm font-semibold text-primary-foreground">{section}</p>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-primary-foreground/65 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10 bg-white/10" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-primary-foreground/60 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {BRANDING.brandName}. All rights reserved.
          </p>
          <p className="max-w-xl text-center sm:text-right">
            {BRANDING.brandName} is a demonstration project built for portfolio purposes — see our{' '}
            <Link href="/terms" className="underline decoration-white/30 underline-offset-2 hover:text-white">
              Terms of Service
            </Link>{' '}
            for details.
          </p>
        </div>
      </div>
    </footer>
  );
}

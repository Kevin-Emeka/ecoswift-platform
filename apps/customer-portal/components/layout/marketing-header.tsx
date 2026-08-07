'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  FileCode,
  GraduationCap,
  Handshake,
  Info,
  LifeBuoy,
  Menu,
  Newspaper,
  PiggyBank,
  Scale,
  ShieldCheck,
  Target,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button, ThemeToggle, cn } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { useAuth } from '../../lib/auth/auth-context';

interface MenuLink {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PERSONAL_LINKS: MenuLink[] = [
  { href: '/account-types#checking', label: 'Checking', description: 'Everyday spending, zero fees.', icon: Wallet },
  { href: '/account-types#savings', label: 'Savings', description: 'Grow your balance automatically.', icon: PiggyBank },
  { href: '/account-types#student', label: 'Student', description: 'Banking for the next chapter.', icon: GraduationCap },
  { href: '/account-types#joint', label: 'Joint', description: 'Shared accounts, shared goals.', icon: Users },
  { href: '/account-types', label: 'Compare all accounts', description: 'See every account side by side.', icon: Scale },
];

const RESOURCE_LINKS: MenuLink[] = [
  { href: '/resources/blog', label: 'Blog', description: 'Product news and banking insights.', icon: Newspaper },
  { href: '/resources/documentation', label: 'Documentation', description: 'Guides for using the platform.', icon: FileCode },
  { href: '/resources/developer-api', label: 'Developer API', description: 'Reference docs for our API.', icon: FileCode },
  { href: '/resources/security-center', label: 'Security Center', description: 'How we protect your data.', icon: ShieldCheck },
  { href: '/resources/help-center', label: 'Help Center', description: 'Answers to common questions.', icon: LifeBuoy },
  { href: '/resources/status', label: 'Status Page', description: 'Live platform availability.', icon: Info },
];

const COMPANY_LINKS: MenuLink[] = [
  { href: '/company/about', label: 'About', description: 'Who we are and what we do.', icon: Info },
  { href: '/company/mission', label: 'Mission', description: 'Why Ecoswift Bank exists.', icon: Target },
  { href: '/company/leadership', label: 'Leadership', description: 'The team behind the platform.', icon: Users },
  { href: '/company/careers', label: 'Careers', description: 'Help us build the future of banking.', icon: Briefcase },
  { href: '/company/press', label: 'Press', description: 'News coverage and press kit.', icon: Newspaper },
  { href: '/company/partners', label: 'Partners', description: 'Who we build alongside.', icon: Handshake },
];

const SIMPLE_LINKS = [
  { href: '/account-types#business', label: 'Business' },
  { href: '/resources/help-center', label: 'Support' },
  { href: '/contact', label: 'Contact' },
];

interface MegaMenu {
  key: string;
  label: string;
  links: MenuLink[];
}

const MEGA_MENUS: MegaMenu[] = [
  { key: 'personal', label: 'Personal', links: PERSONAL_LINKS },
  { key: 'resources', label: 'Resources', links: RESOURCE_LINKS },
  { key: 'company', label: 'Company', links: COMPANY_LINKS },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  const navRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function openWithDelay(key: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(key);
  }

  function closeWithDelay() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-shadow duration-300',
        scrolled ? 'shadow-premium' : '',
      )}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpenMenu(null);
      }}
    >
      <div
        className={cn(
          'border-b border-border/60 transition-colors duration-300',
          scrolled ? 'glass' : 'bg-background',
        )}
      >
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-bank-sm bg-brand-gradient text-sm font-extrabold text-white shadow-premium">
              {BRANDING.shortName.slice(0, 2)}
            </span>
            <span>{BRANDING.brandName}</span>
          </Link>

          <nav ref={navRef} className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {MEGA_MENUS.map((menu) => (
              <div
                key={menu.key}
                className="relative"
                onMouseEnter={() => openWithDelay(menu.key)}
                onMouseLeave={closeWithDelay}
              >
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground',
                    openMenu === menu.key && 'bg-accent text-foreground',
                  )}
                  aria-expanded={openMenu === menu.key}
                  onClick={(e) => {
                    // A click is always preceded by a hover (mouseenter already
                    // opened this menu), so toggling here would immediately
                    // close what the hover just opened. Click always opens;
                    // closing happens via hover-away, Escape, or the
                    // click-outside listener below.
                    e.stopPropagation();
                    setOpenMenu(menu.key);
                  }}
                  onFocus={() => openWithDelay(menu.key)}
                >
                  {menu.label}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', openMenu === menu.key && 'rotate-180')} />
                </button>

                {openMenu === menu.key && (
                  <div
                    className="animate-in absolute left-1/2 top-full mt-2 w-[560px] -translate-x-1/2 rounded-bank-md border border-border bg-popover p-3 shadow-premium-lg"
                    onMouseEnter={() => openWithDelay(menu.key)}
                    onMouseLeave={closeWithDelay}
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {menu.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-accent"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent transition-colors group-hover:bg-brand-accent group-hover:text-white">
                            <link.icon className="h-[18px] w-[18px]" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-foreground">{link.label}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{link.description}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {SIMPLE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground',
                  pathname === link.href ? 'text-foreground' : 'text-foreground/80',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            {user ? (
              <Button asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button variant="gradient" asChild>
                  <Link href="/register">
                    Open Account <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="animate-in max-h-[calc(100vh-64px)] overflow-y-auto border-b border-border bg-background p-4 lg:hidden">
          <div className="space-y-1">
            {MEGA_MENUS.map((menu) => (
              <details key={menu.key} className="group rounded-xl border border-border/60 p-1">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground">
                  {menu.label}
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="space-y-0.5 px-1 pb-2 pt-1">
                  {menu.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <link.icon className="h-4 w-4 text-brand-accent" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
            {SIMPLE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            {user ? (
              <Button asChild className="w-full">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button variant="gradient" asChild className="w-full">
                  <Link href="/register">Open Account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

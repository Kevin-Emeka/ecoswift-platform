'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Input, cn } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';

interface Faq {
  category: string;
  question: string;
  answer: React.ReactNode;
  keywords: string;
}

const FAQS: Faq[] = [
  {
    category: 'General',
    question: `What is ${BRANDING.brandName}?`,
    answer: `${BRANDING.brandName} is a full-stack digital banking platform, built with a production-oriented architecture — account opening, a real double-entry ledger, security controls, and admin tooling — designed to show what a modern digital bank looks like end to end.`,
    keywords: 'what is ecoswift about platform',
  },
  {
    category: 'General',
    question: 'Is this a real, licensed bank?',
    answer:
      `${BRANDING.brandName} is a demonstration platform that showcases the architecture, workflows, and controls of a modern digital bank — account opening, a real double-entry ledger, security tooling, and admin/compliance views, all built to production standards. It is not a chartered or licensed financial institution: it isn't connected to any banking network, card network, or payment rail, and no real funds are ever moved or held. Full details are in our Terms of Service.`,
    keywords: 'real money deposit withdraw funds bank licensed',
  },
  {
    category: 'Accounts',
    question: 'How do I open an account?',
    answer:
      'Click "Open Account" from the header or homepage and complete the registration flow. You can choose from Savings, Current, Fixed Deposit, or Business account types. Once created, your account is issued a properly formatted, unique account number.',
    keywords: 'open account register signup',
  },
  {
    category: 'Accounts',
    question: 'How do deposits and withdrawals work?',
    answer:
      'From your dashboard you can make deposits, withdrawals, and transfers. Each transaction runs through realistic validation and posting logic and updates a real, balanced double-entry ledger behind the scenes, so balances always reconcile — just as they would on a production banking core.',
    keywords: 'deposit withdraw transaction ledger balance',
  },
  {
    category: 'Security',
    question: 'What security features are in place?',
    answer:
      'The platform includes multi-factor authentication (MFA), device trust and recognition, active session management, and full audit trails on account activity, reflecting the kind of controls a real financial institution would run.',
    keywords: 'security mfa device session audit',
  },
  {
    category: 'Security',
    question: 'How do I set up multi-factor authentication?',
    answer:
      'After signing in, visit your account security settings to enroll in MFA. Once enabled, you will be asked for a second verification step on new devices or sensitive actions such as changing account details.',
    keywords: 'mfa two factor authentication setup',
  },
  {
    category: 'Security',
    question: 'Is there an admin or compliance view?',
    answer:
      'Yes. Behind the scenes, an admin console provides audit logs, role and permission management, and compliance-oriented reporting, so teams can see how administrative and compliance tooling might work on a real platform.',
    keywords: 'admin compliance audit logs roles',
  },
  {
    category: 'Privacy & Support',
    question: 'How is my data handled?',
    answer:
      'We collect only the information needed to operate the platform, such as your registration details and transaction activity. We do not sell personal data. See our Privacy Policy for full details on what is collected and how it is used.',
    keywords: 'privacy data personal information',
  },
  {
    category: 'Privacy & Support',
    question: 'How do I contact support?',
    answer: (
      <>
        Visit the{' '}
        <Link href="/contact" className="font-medium text-brand-accent underline-offset-4 hover:underline">
          Contact page
        </Link>{' '}
        to send us a message, or email us directly at{' '}
        <a href={`mailto:${BRANDING.emails.support}`} className="font-medium text-brand-accent underline-offset-4 hover:underline">
          {BRANDING.emails.support}
        </a>
        .
      </>
    ),
    keywords: 'contact support help email',
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(FAQS.map((f) => f.category)))];

export default function FaqPage() {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('All');

  const filtered = FAQS.filter((faq) => {
    const matchesCategory = category === 'All' || faq.category === category;
    const haystack = `${faq.question} ${faq.keywords}`.toLowerCase();
    const matchesQuery = query.trim() === '' || haystack.includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 md:px-6 md:py-28">
      <div className="text-center">
        <Badge variant="brand">FAQ</Badge>
        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">Frequently asked questions</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Answers about how {BRANDING.brandName} works. If you don&apos;t see what you&apos;re looking for,{' '}
          <Link href="/contact" className="font-medium text-brand-accent underline-offset-4 hover:underline">
            get in touch
          </Link>
          .
        </p>
      </div>

      <div className="relative mt-10">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          className="h-12 rounded-full pl-11"
          aria-label="Search FAQs"
        />
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              category === c
                ? 'border-brand-accent bg-brand-accent text-white'
                : 'border-border bg-card text-muted-foreground hover:border-brand-accent/40 hover:text-foreground',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <Accordion type="single" collapsible className="mt-10 space-y-3">
        {filtered.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">No questions match &ldquo;{query}&rdquo;.</p>
      )}
    </section>
  );
}

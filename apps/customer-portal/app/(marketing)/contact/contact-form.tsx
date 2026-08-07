'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button, Input, Label } from '@ecoswift/ui';

export function ContactForm() {
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', email: '', subject: '', message: '' });

  function handleChange(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    // No contact-form backend exists yet — simulate the round trip locally so
    // the interaction still feels complete.
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 600);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p className="text-lg font-semibold">Thanks, we&apos;ll be in touch</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          We&apos;ve received your message. This is a demo project, so no reply is sent automatically — for a real response,
          please reach us directly at the email addresses on this page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" required value={form.name} onChange={handleChange('name')} placeholder="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange('email')}
            placeholder="jane@example.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-subject">Subject</Label>
        <Input
          id="contact-subject"
          name="subject"
          required
          value={form.subject}
          onChange={handleChange('subject')}
          placeholder="How can we help?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          value={form.message}
          onChange={handleChange('message')}
          placeholder="Tell us more..."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Button type="submit" size="lg" loading={submitting} className="w-full sm:w-auto">
        {submitting ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}

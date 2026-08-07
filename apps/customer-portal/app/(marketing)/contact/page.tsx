import { Clock, Mail, MapPin, MessageCircle } from 'lucide-react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ecoswift/ui';
import { BRANDING } from '@ecoswift/config/branding';
import { ContactForm } from './contact-form';

const SUPPORT_CARDS = [
  { icon: Mail, title: 'General support', value: BRANDING.emails.support },
  { icon: MessageCircle, title: 'Help desk', value: BRANDING.emails.helpDesk },
];

const BUSINESS_HOURS = [
  ['Monday – Friday', '8:00 AM – 8:00 PM ET'],
  ['Saturday', '9:00 AM – 5:00 PM ET'],
  ['Sunday', 'Closed'],
];

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="brand">Contact</Badge>
        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">Get in touch</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Questions about {BRANDING.brandName}? Send us a message, or reach out directly using the addresses below.
        </p>
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          {SUPPORT_CARDS.map((card) => (
            <Card key={card.title} className="card-lift">
              <CardHeader>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                  <card.icon className="h-5 w-5" />
                </span>
                <CardTitle className="mt-3 text-base">{card.title}</CardTitle>
                <CardDescription>
                  <a href={`mailto:${card.value}`} className="font-medium text-brand-accent underline-offset-4 hover:underline">
                    {card.value}
                  </a>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                <Clock className="h-5 w-5" />
              </span>
              <CardTitle className="mt-3 text-base">Business hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {BUSINESS_HOURS.map(([day, hours]) => (
                <div key={day} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{day}</span>
                  <span className="font-medium text-foreground">{hours}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            {BRANDING.brandName} is a demonstration project. Support requests relate to the demo platform itself —
            no real account or funds support is offered, as none exists here.
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
              <CardDescription>Fill out the form and we&apos;ll follow up by email.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContactForm />
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex h-56 flex-col items-center justify-center gap-2 bg-brand-radial text-white">
              <MapPin className="h-8 w-8 text-brand-accent" />
              <p className="text-sm font-medium text-white/80">Illustrative office location</p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

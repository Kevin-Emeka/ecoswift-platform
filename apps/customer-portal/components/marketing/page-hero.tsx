import type { LucideIcon } from 'lucide-react';
import { Badge } from '@ecoswift/ui';

export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <section className="bg-brand-radial py-20 text-center text-white md:py-28">
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        {Icon && (
          <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-brand-accent">
            <Icon className="h-7 w-7" />
          </span>
        )}
        <Badge variant="brand" className="border-white/20 bg-white/10 text-white">
          {eyebrow}
        </Badge>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-6 text-lg text-white/70">{description}</p>
      </div>
    </section>
  );
}

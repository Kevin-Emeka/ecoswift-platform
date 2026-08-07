import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as not requiring authentication. Canonical, shared version —
 * Phase 1 scaffolded a local copy in every app's `common/decorators/public.decorator.ts`
 * "once an auth guard is introduced" (now true for `auth-service`, Phase 3A).
 * A guard and the routes it exempts (e.g. `@ecoswift/observability`'s
 * `MetricsController`) must agree on the same `IS_PUBLIC_KEY` — which only
 * a shared decorator guarantees across package boundaries. Services
 * without an auth guard yet can keep their local copy inert; adopt this
 * one when they add one, per docs/authentication.md.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Re-exports the canonical `@ecoswift/shared` decorator — kept as a local
 * module so every controller in this service can still import from
 * `../../../common/decorators/public.decorator` without churn, while
 * guaranteeing the same `IS_PUBLIC_KEY` is used by `JwtAuthGuard`
 * (`modules/auth/guards/jwt-auth.guard.ts`) and by shared-package
 * controllers like `@ecoswift/observability`'s `MetricsController`.
 */
export { Public, IS_PUBLIC_KEY } from '@ecoswift/shared';

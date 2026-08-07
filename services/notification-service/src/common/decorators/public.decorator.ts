/**
 * Re-exports the canonical `@ecoswift/shared` decorator — kept as a local
 * module so every controller in this service can still import from
 * `../../../common/decorators/public.decorator` without churn, while
 * guaranteeing the same `IS_PUBLIC_KEY` `@ecoswift/auth-client`'s
 * `JwtAuthGuard` checks.
 */
export { Public, IS_PUBLIC_KEY } from '@ecoswift/shared';

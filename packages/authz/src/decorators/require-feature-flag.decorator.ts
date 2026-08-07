import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_FLAG_KEY = 'authz:require-feature-flag';

/**
 * Gates a route behind `FeatureFlagGuard` — evaluates the named
 * `FeatureFlag` (`@ecoswift/config`'s `FeatureFlagService.isEnabled()`,
 * scoped to the requesting user for percentage-rollout/scope matching). A
 * disabled flag reads to the caller as `404 Not Found`, not `403
 * Forbidden` — a flagged-off feature is modeled as not existing yet, not
 * as something the caller is blocked from.
 */
export const RequireFeatureFlag = (key: string) => SetMetadata(REQUIRE_FEATURE_FLAG_KEY, key);

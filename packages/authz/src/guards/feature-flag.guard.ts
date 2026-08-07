import { type CanActivate, type ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from '@ecoswift/config';
import { REQUIRE_FEATURE_FLAG_KEY } from '../decorators/require-feature-flag.decorator';
import type { AuthorizedRequest } from '../interfaces/authorized-request.interface';

/**
 * Enforces `@RequireFeatureFlag(key)` by delegating straight to
 * `@ecoswift/config`'s `FeatureFlagService` (Phase 2C) — this guard adds
 * nothing to flag *evaluation*, only the HTTP-layer wiring: a disabled
 * flag short-circuits the request as `404`, before the handler runs.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!key) return true;

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const enabled = await this.featureFlags.isEnabled(key, { subjectId: request.user?.userId });
    if (!enabled) {
      throw new NotFoundException();
    }
    return true;
  }
}

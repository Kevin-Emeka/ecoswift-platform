import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.service';

export const REQUIRE_CSRF_TOKEN_KEY = 'security:require-csrf-token';

/** Marks a route as needing double-submit CSRF verification — applied to cookie-authenticated, state-changing routes (`authentication.md`'s `/v1/auth/refresh` and `/v1/auth/logout`). */
export const RequireCsrfToken = () => SetMetadata(REQUIRE_CSRF_TOKEN_KEY, true);

/**
 * Enforces `@RequireCsrfToken()`: the `x-csrf-token` header must be present
 * and match the `ecoswift_csrf_token` cookie exactly. A route without the
 * decorator is unaffected — this guard, like every guard in
 * `@ecoswift/authz`, only ever adds a restriction where explicitly asked.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRE_CSRF_TOKEN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = (request.cookies as Record<string, string | undefined> | undefined)?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken || Array.isArray(headerToken) || headerToken !== cookieToken) {
      throw new ForbiddenException('Missing or invalid CSRF token');
    }
    return true;
  }
}

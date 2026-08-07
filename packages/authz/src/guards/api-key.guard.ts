import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SCOPES_KEY } from '../decorators/require-scopes.decorator';
import { API_KEY_VALIDATOR, type ApiKeyValidatorPort } from '../interfaces/api-key-validator.port';
import type { AuthorizedRequest } from '../interfaces/authorized-request.interface';

const API_KEY_HEADER = 'x-api-key';

/**
 * Service-to-service / machine-client authorization via `X-API-Key`,
 * independent of the session-based `JwtAuthGuard`/`PermissionsGuard` path
 * (docs/authorization.md § Scope-Based Authorization). Only enforces
 * anything on routes carrying `@RequireScopes(...)` — like the other
 * guards in this package, absence of the decorator means this guard is not
 * this route's concern.
 *
 * A missing or unrecognized key is `401`; a recognized key lacking a
 * required scope is `403` — the same distinction `PermissionsGuard` draws
 * between "not authenticated" and "authenticated but not authorized."
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(API_KEY_VALIDATOR) private readonly validator: ApiKeyValidatorPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRE_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthorizedRequest & { headers: Record<string, string | undefined> }>();
    const rawKey = request.headers[API_KEY_HEADER];
    if (!rawKey) {
      throw new UnauthorizedException('An API key is required for this action');
    }

    const validated = await this.validator.validate(rawKey);
    if (!validated) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const missing = required.filter((scope) => !validated.scopes.includes(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(`API key is missing required scope(s): ${missing.join(', ')}`);
    }

    request.apiKey = validated;
    return true;
  }
}

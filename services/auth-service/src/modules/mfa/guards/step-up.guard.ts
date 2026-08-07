import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../../auth/services/token.service';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

export const REQUIRE_STEP_UP_KEY = 'mfa:require-step-up';
export const STEP_UP_HEADER = 'x-step-up-token';

/** Marks a route as needing a fresh step-up assertion in addition to normal authentication — `disableFactor`/`regenerateBackupCodes` in `mfa.controller.ts`. */
export const RequireStepUp = () => SetMetadata(REQUIRE_STEP_UP_KEY, true);

/**
 * Enforces `@RequireStepUp()`: the `X-Step-Up-Token` header must be a
 * valid, unexpired step-up token (`TokenService.issueStepUpToken`,
 * `StepUpService.completeStepUp`) issued for **this exact session** — a
 * step-up completed on one device/session never satisfies a sensitive
 * action attempted from another, even for the same user.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRE_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication is required for this action');
    }

    const headerValue = request.headers[STEP_UP_HEADER];
    const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!token) {
      throw new ForbiddenException('This action requires a recent step-up verification (X-Step-Up-Token)');
    }

    try {
      const payload = await this.tokenService.verifyStepUpToken(token);
      if (payload.sub !== request.user.userId || payload.sessionId !== request.user.sessionId) {
        throw new Error('mismatch');
      }
    } catch {
      throw new ForbiddenException('Step-up verification is missing, expired, or does not match this session');
    }

    return true;
  }
}

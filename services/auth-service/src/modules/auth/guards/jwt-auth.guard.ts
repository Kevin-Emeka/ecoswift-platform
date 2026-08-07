import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Registered as the app-wide `APP_GUARD` (`auth.module.ts`) — every route
 * requires authentication **by default**; `@Public()` is the explicit
 * opt-out for the handful of routes that must work without a token
 * (register, login, refresh, forgot/reset-password, verify-email,
 * verify-phone, health, docs). Secure-by-default rather than
 * secure-by-remembering-to-add-a-guard-to-every-new-route.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

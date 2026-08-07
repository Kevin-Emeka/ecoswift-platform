import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@ecoswift/database';
import type { AccessTokenPayload } from '../services/token.service';
import { TOKEN_USE } from '../constants/auth.constants';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  actorType: string;
  /** Phase 3C addition — `MfaController.enrollTotp()` needs it for the `otpauth://` provisioning URI's label, and `JwtStrategy` already fetches the `User` row for the status check below, so this is free. */
  email: string;
}

/**
 * Validates the access token AND re-checks the underlying `Session` is
 * still `ACTIVE` on every request — a JWT's own expiry can't be shortened
 * after issuance, so revocation (logout, password reset, admin-forced
 * logout) only actually takes effect immediately if something outside the
 * token itself is checked on every use. This is that check
 * (security-model.md § Session Lifecycle: "Revocation must take effect on
 * the very next request, not just on next refresh").
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.tokenUse !== TOKEN_USE.ACCESS) {
      throw new UnauthorizedException('Invalid token type');
    }

    const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.status !== 'ACTIVE' || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is no longer active');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is not active');
    }

    return { userId: payload.sub, sessionId: payload.sessionId, actorType: payload.actorType, email: user.email };
  }
}

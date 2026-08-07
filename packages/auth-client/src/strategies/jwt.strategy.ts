import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@ecoswift/database';

export interface AccessTokenPayload {
  sub: string;
  sessionId: string;
  actorType: string;
  tokenUse: string;
}

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  actorType: string;
  email: string;
}

/**
 * Verifies access tokens `auth-service` issues — this package's only
 * concern; nothing here issues or refreshes tokens. Every downstream
 * service (account-service, audit-service, notification-service, etc.)
 * shares this exact verification logic against the same `jwt.secret` and
 * the same `Session` table, rather than each hand-rolling its own copy —
 * account-service's original copy (Phase 4A,
 * `modules/auth/strategies/jwt.strategy.ts`) is the source this package
 * was extracted from once a third service needed the identical code.
 *
 * Re-checking `Session.status === 'ACTIVE'` on every request (not just
 * trusting the JWT's own expiry) is required so a revocation on
 * auth-service (logout, forced logout) takes effect on this service's
 * very next request too.
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
    if (payload.tokenUse !== 'access') {
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

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
  deviceId?: string;
}

/**
 * account-service does not issue tokens (auth-service owns that) but
 * verifies the same access tokens auth-service issues, against the same
 * shared `jwt.secret` and the same `Session` table — a duplicated
 * strategy, not a shared package, matching the precedent set by
 * auth-service's own `JwtStrategy` (each service owns its auth layer; see
 * `packages/authz`'s `AuthorizedRequest` interface, deliberately minimal
 * for exactly this reason). Re-checking `Session.status === 'ACTIVE'` on
 * every request (not just trusting the JWT's expiry) is required so a
 * revocation on auth-service (logout, forced logout) takes effect here on
 * the very next request too.
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

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      actorType: payload.actorType,
      email: user.email,
      deviceId: session.deviceId ?? undefined,
    };
  }
}

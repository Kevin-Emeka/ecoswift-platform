import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConfigurationService } from '@ecoswift/config';
import { AUTH_DEFAULTS, TOKEN_USE } from '../constants/auth.constants';

export interface AccessTokenPayload {
  sub: string; // userId
  sessionId: string;
  actorType: string;
  tokenUse: typeof TOKEN_USE.ACCESS;
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  tokenUse: typeof TOKEN_USE.REFRESH;
  jti: string;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresAt: Date;
}

/** Phase 3C — issued mid-login when 2FA is enabled; proves "password already verified for this user" without yet being a usable session credential. */
export interface MfaChallengePayload {
  sub: string;
  rememberMe: boolean;
  tokenUse: typeof TOKEN_USE.MFA_CHALLENGE;
  jti: string;
}

/** Phase 3C — proves a fresh MFA re-verification happened for this session, recently. */
export interface StepUpPayload {
  sub: string;
  sessionId: string;
  tokenUse: typeof TOKEN_USE.STEP_UP;
  jti: string;
}

/**
 * Signs and verifies both token kinds with **separate secrets**
 * (`JWT_SECRET` / `JWT_REFRESH_SECRET`, both already in
 * `packages/config/src/env.schema.ts` since Phase 1) — a leaked access
 * token (short-lived, sent on every request, the more exposed of the two)
 * can never be replayed as a refresh token and vice versa, since each
 * secret only validates its own token kind. `@nestjs/jwt`'s `JwtService`
 * accepts a per-call `secret` override, so one service instance handles
 * both rather than needing two separately configured modules.
 *
 * The refresh token's *hash* (never the token itself) is what
 * `SessionService` persists to `Session.refreshTokenHash` for rotation and
 * reuse detection — see `session.service.ts`.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly configurationService: ConfigurationService,
  ) {}

  /** Days until a refresh token of this kind expires — exposed so `SessionService.createSession` can set `Session.expiresAt` consistently before the token itself is signed (the session row must exist first, to have a `sessionId` to embed in the token). */
  async refreshTokenTtlDays(rememberMe: boolean): Promise<number> {
    return rememberMe
      ? this.configurationService.getNumber(
          'refresh_token.remember_me_ttl_days',
          AUTH_DEFAULTS.refreshTokenRememberMeTtlDays,
        )
      : this.configurationService.getNumber('refresh_token.ttl_days', AUTH_DEFAULTS.refreshTokenTtlDays);
  }

  async issueTokenPair(
    userId: string,
    sessionId: string,
    actorType: string,
    rememberMe: boolean,
  ): Promise<IssuedTokenPair> {
    const accessTtlMinutes = await this.configurationService.getNumber(
      'access_token.ttl_minutes',
      AUTH_DEFAULTS.accessTokenTtlMinutes,
    );
    const refreshTtlDays = await this.refreshTokenTtlDays(rememberMe);

    const accessTokenExpiresInSeconds = accessTtlMinutes * 60;
    const refreshTokenExpiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      sessionId,
      actorType,
      tokenUse: TOKEN_USE.ACCESS,
      jti: randomUUID(),
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sessionId,
      tokenUse: TOKEN_USE.REFRESH,
      jti: randomUUID(),
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: `${accessTokenExpiresInSeconds}s`,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: `${refreshTtlDays}d`,
    });

    return { accessToken, refreshToken, accessTokenExpiresInSeconds, refreshTokenExpiresAt };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: this.configService.get<string>('jwt.secret'),
    });
    if (payload.tokenUse !== TOKEN_USE.ACCESS) {
      throw new Error('Not an access token');
    }
    return payload;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
    });
    if (payload.tokenUse !== TOKEN_USE.REFRESH) {
      throw new Error('Not a refresh token');
    }
    return payload;
  }

  /** SHA-256 of a raw token — what's actually persisted (`Session.refreshTokenHash`/`accessTokenHash`), never the token itself. */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueMfaChallengeToken(userId: string, rememberMe: boolean): Promise<string> {
    const ttlMinutes = await this.configurationService.getNumber(
      'mfa.challenge_ttl_minutes',
      AUTH_DEFAULTS.mfaChallengeTtlMinutes,
    );
    const payload: MfaChallengePayload = { sub: userId, rememberMe, tokenUse: TOKEN_USE.MFA_CHALLENGE, jti: randomUUID() };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: `${ttlMinutes}m`,
    });
  }

  async verifyMfaChallengeToken(token: string): Promise<MfaChallengePayload> {
    const payload = await this.jwtService.verifyAsync<MfaChallengePayload>(token, {
      secret: this.configService.get<string>('jwt.secret'),
    });
    if (payload.tokenUse !== TOKEN_USE.MFA_CHALLENGE) {
      throw new Error('Not an MFA challenge token');
    }
    return payload;
  }

  async issueStepUpToken(userId: string, sessionId: string): Promise<string> {
    const ttlMinutes = await this.configurationService.getNumber('mfa.step_up_ttl_minutes', AUTH_DEFAULTS.stepUpTtlMinutes);
    const payload: StepUpPayload = { sub: userId, sessionId, tokenUse: TOKEN_USE.STEP_UP, jti: randomUUID() };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: `${ttlMinutes}m`,
    });
  }

  async verifyStepUpToken(token: string): Promise<StepUpPayload> {
    const payload = await this.jwtService.verifyAsync<StepUpPayload>(token, {
      secret: this.configService.get<string>('jwt.secret'),
    });
    if (payload.tokenUse !== TOKEN_USE.STEP_UP) {
      throw new Error('Not a step-up token');
    }
    return payload;
  }
}

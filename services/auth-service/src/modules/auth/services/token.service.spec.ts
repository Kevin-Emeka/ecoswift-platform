import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import type { ConfigService } from '@nestjs/config';
import type { ConfigurationService } from '@ecoswift/config';
import { TOKEN_USE } from '../constants/auth.constants';

describe('TokenService', () => {
  let jwtService: JwtService;
  let configService: { get: jest.Mock };
  let configurationService: { getNumber: jest.Mock };
  let service: TokenService;

  const secrets: Record<string, string> = {
    'jwt.secret': 'access-secret-for-tests',
    'jwt.refreshSecret': 'refresh-secret-for-tests',
  };

  beforeEach(() => {
    jwtService = new JwtService({});
    configService = { get: jest.fn().mockImplementation((key: string) => secrets[key]) };
    configurationService = {
      getNumber: jest.fn().mockImplementation((_key: string, fallback: number) => Promise.resolve(fallback)),
    };
    service = new TokenService(
      jwtService,
      configService as unknown as ConfigService,
      configurationService as unknown as ConfigurationService,
    );
  });

  describe('refreshTokenTtlDays', () => {
    it('reads the remember-me TTL when rememberMe is true', async () => {
      configurationService.getNumber.mockImplementation((key: string) =>
        Promise.resolve(key === 'refresh_token.remember_me_ttl_days' ? 30 : 7),
      );
      await expect(service.refreshTokenTtlDays(true)).resolves.toBe(30);
    });

    it('reads the standard TTL when rememberMe is false', async () => {
      configurationService.getNumber.mockImplementation((key: string) =>
        Promise.resolve(key === 'refresh_token.ttl_days' ? 7 : 30),
      );
      await expect(service.refreshTokenTtlDays(false)).resolves.toBe(7);
    });
  });

  describe('issueTokenPair', () => {
    it('signs an access/refresh pair with distinct secrets, each carrying the right tokenUse', async () => {
      const pair = await service.issueTokenPair('user-1', 'session-1', 'CUSTOMER', false);

      expect(pair.accessToken).not.toEqual(pair.refreshToken);
      expect(pair.accessTokenExpiresInSeconds).toBeGreaterThan(0);
      expect(pair.refreshTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());

      const accessPayload = await service.verifyAccessToken(pair.accessToken);
      expect(accessPayload).toMatchObject({ sub: 'user-1', sessionId: 'session-1', tokenUse: TOKEN_USE.ACCESS });

      const refreshPayload = await service.verifyRefreshToken(pair.refreshToken);
      expect(refreshPayload).toMatchObject({ sub: 'user-1', sessionId: 'session-1', tokenUse: TOKEN_USE.REFRESH });
    });

    it('cannot verify an access token against the refresh secret or vice versa', async () => {
      const pair = await service.issueTokenPair('user-1', 'session-1', 'CUSTOMER', false);

      await expect(service.verifyRefreshToken(pair.accessToken)).rejects.toThrow();
      await expect(service.verifyAccessToken(pair.refreshToken)).rejects.toThrow();
    });
  });

  describe('token-use enforcement', () => {
    it('rejects a well-signed refresh token presented as an access token', async () => {
      const refreshToken = await jwtService.signAsync(
        { sub: 'user-1', sessionId: 'session-1', tokenUse: TOKEN_USE.REFRESH, jti: 'x' },
        { secret: secrets['jwt.secret'] },
      );
      await expect(service.verifyAccessToken(refreshToken)).rejects.toThrow('Not an access token');
    });

    it('rejects a well-signed access token presented as a refresh token', async () => {
      const accessToken = await jwtService.signAsync(
        { sub: 'user-1', sessionId: 'session-1', tokenUse: TOKEN_USE.ACCESS, jti: 'x' },
        { secret: secrets['jwt.refreshSecret'] },
      );
      await expect(service.verifyRefreshToken(accessToken)).rejects.toThrow('Not a refresh token');
    });
  });

  describe('hashToken', () => {
    it('is deterministic for the same input', () => {
      expect(service.hashToken('abc')).toEqual(service.hashToken('abc'));
    });

    it('differs for different inputs', () => {
      expect(service.hashToken('abc')).not.toEqual(service.hashToken('abd'));
    });

    it('never returns the raw token itself', () => {
      expect(service.hashToken('abc')).not.toEqual('abc');
    });
  });
});

import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '@ecoswift/database';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let prisma: { session: { findUnique: jest.Mock }; user: { findUnique: jest.Mock } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = { session: { findUnique: jest.fn() }, user: { findUnique: jest.fn() } };
    const configService = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    strategy = new JwtStrategy(configService, prisma as unknown as PrismaService);
  });

  const basePayload = { sub: 'user-1', sessionId: 'session-1', actorType: 'CUSTOMER', tokenUse: 'access' };

  it('rejects tokens that are not access tokens', async () => {
    await expect(strategy.validate({ ...basePayload, tokenUse: 'refresh' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the session no longer exists', async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the session is not ACTIVE', async () => {
    prisma.session.findUnique.mockResolvedValue({ status: 'REVOKED', expiresAt: new Date(Date.now() + 60_000) });
    await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the session has expired', async () => {
    prisma.session.findUnique.mockResolvedValue({ status: 'ACTIVE', expiresAt: new Date(Date.now() - 60_000) });
    await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the user no longer exists', async () => {
    prisma.session.findUnique.mockResolvedValue({ status: 'ACTIVE', expiresAt: new Date(Date.now() + 60_000) });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
  });

  it.each(['DEACTIVATED', 'SUSPENDED'])('rejects when the user status is %s', async (status) => {
    prisma.session.findUnique.mockResolvedValue({ status: 'ACTIVE', expiresAt: new Date(Date.now() + 60_000) });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', status });
    await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
  });

  it('resolves an AuthenticatedUser for a valid session and active user', async () => {
    prisma.session.findUnique.mockResolvedValue({ status: 'ACTIVE', expiresAt: new Date(Date.now() + 60_000) });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com', status: 'ACTIVE' });

    const result = await strategy.validate(basePayload);
    expect(result).toEqual({ userId: 'user-1', sessionId: 'session-1', actorType: 'CUSTOMER', email: 'a@example.com' });
  });
});

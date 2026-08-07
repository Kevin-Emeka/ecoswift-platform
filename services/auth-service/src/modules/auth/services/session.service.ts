import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { ConfigurationService } from '@ecoswift/config';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, SESSION_CREATED, SESSION_REVOKED } from '@ecoswift/event-bus';
import { AUTH_DEFAULTS } from '../constants/auth.constants';

export interface CreateSessionInput {
  userId: string;
  deviceId?: string;
  ipAddress: string;
  userAgent?: string;
  expiresAt: Date;
}

/**
 * Session lifecycle over `Session` (Phase 2B schema) — issue, list, revoke,
 * enforce `session.max_concurrent` (business-rules.md § Session Policy).
 * A `Session` row is the "family" a refresh token belongs to: rotating the
 * refresh token updates this same row's `refreshTokenHash`, it doesn't
 * create a new row — see `token.service.ts` and `auth.service.ts`'s
 * refresh flow for why that distinction matters for reuse detection.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configurationService: ConfigurationService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async createSession(input: CreateSessionInput) {
    await this.enforceConcurrentLimit(input.userId);

    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt,
        status: 'ACTIVE',
      },
    });

    await this.eventPublisher.publish({
      eventType: SESSION_CREATED,
      producerContext: 'auth-service',
      payload: {
        sessionId: session.id,
        userId: input.userId,
        deviceId: input.deviceId,
        ipAddress: input.ipAddress,
      },
    });

    return session;
  }

  async setTokenHashes(sessionId: string, accessTokenHash: string, refreshTokenHash: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { accessTokenHash, refreshTokenHash },
    });
  }

  async findActiveById(sessionId: string) {
    return this.prisma.session.findFirst({
      where: { id: sessionId, status: 'ACTIVE' },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { issuedAt: 'desc' },
      include: { device: true },
    });
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'ACTIVE') return;

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason },
    });

    await this.eventPublisher.publish({
      eventType: SESSION_REVOKED,
      producerContext: 'auth-service',
      payload: { sessionId, userId: session.userId, reason },
    });
  }

  /** Revokes every active session for a user except (optionally) one — used on password reset/change and "log out everywhere." */
  async revokeAllForUser(userId: string, reason: string, exceptSessionId?: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, status: 'ACTIVE', ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });

    for (const { id } of sessions) {
      await this.revoke(id, reason);
    }
  }

  /**
   * `session.max_concurrent` (business-rules.md § Session Policy): once
   * the limit would be exceeded, the least-recently-issued active session
   * is revoked to make room — a new login should never be the one that's
   * silently rejected, an old forgotten one should be.
   */
  private async enforceConcurrentLimit(userId: string): Promise<void> {
    const maxConcurrent = await this.configurationService.getNumber(
      'session.max_concurrent',
      AUTH_DEFAULTS.maxConcurrentSessions,
    );

    const activeSessions = await this.prisma.session.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { issuedAt: 'asc' },
      select: { id: true },
    });

    if (activeSessions.length >= maxConcurrent) {
      const excessCount = activeSessions.length - maxConcurrent + 1;
      const toRevoke = activeSessions.slice(0, excessCount);
      for (const { id } of toRevoke) {
        await this.revoke(id, 'CONCURRENT_SESSION_LIMIT_EXCEEDED');
      }
    }
  }
}

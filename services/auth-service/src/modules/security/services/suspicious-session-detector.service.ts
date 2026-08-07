import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { ConfigurationService } from '@ecoswift/config';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, SUSPICIOUS_SESSION_DETECTED } from '@ecoswift/event-bus';
import { SecurityEventService } from './security-event.service';

const DEFAULT_WINDOW_MINUTES = 5;

/**
 * Suspicious Session Detection (Phase 3C brief § Session Security) — a
 * real, working heuristic, not an extension-point stub like the Fraud
 * Detection Hooks: a brand-new session for a user who already holds
 * another still-active session from a **different IP address**, opened
 * within `session.suspicious_ip_change_window_minutes` of each other, is
 * flagged. Two logins from different networks within a few minutes of
 * each other is either a legitimate multi-device moment (a laptop and a
 * phone both signing in) or a credential-sharing/compromise signal — this
 * service can't tell which, so it only **records and notifies**
 * (`SecurityEvent` + `SUSPICIOUS_SESSION_DETECTED`), it never blocks or
 * revokes anything itself. Real geo-IP resolution (which would make this
 * "impossible travel" properly, not just "different IP") is out of scope —
 * `authentication.md`'s already-documented gap, unchanged by this phase.
 */
@Injectable()
export class SuspiciousSessionDetectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configurationService: ConfigurationService,
    private readonly securityEvents: SecurityEventService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async evaluate(userId: string, newSessionId: string, newIpAddress: string): Promise<void> {
    const windowMinutes = await this.configurationService.getNumber(
      'session.suspicious_ip_change_window_minutes',
      DEFAULT_WINDOW_MINUTES,
    );
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentOtherSession = await this.prisma.session.findFirst({
      where: {
        userId,
        id: { not: newSessionId },
        status: 'ACTIVE',
        ipAddress: { not: newIpAddress },
        issuedAt: { gte: since },
      },
      orderBy: { issuedAt: 'desc' },
    });

    if (!recentOtherSession) return;

    await this.securityEvents.record({
      userId,
      eventType: 'SUSPICIOUS_SESSION',
      metadata: {
        newSessionId,
        newIpAddress,
        previousSessionId: recentOtherSession.id,
        previousIpAddress: recentOtherSession.ipAddress,
        windowMinutes,
      },
    });
    await this.eventPublisher.publish({
      eventType: SUSPICIOUS_SESSION_DETECTED,
      producerContext: 'auth-service',
      payload: {
        userId,
        sessionId: newSessionId,
        reason: 'CONCURRENT_SESSION_DIFFERENT_IP',
        previousIpAddress: recentOtherSession.ipAddress,
        newIpAddress,
      },
    });
  }
}

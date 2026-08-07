import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { UAParser } from 'ua-parser-js';
import { FRAUD_HOOKS, type FraudHooksPort } from '@ecoswift/security';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, DEVICE_REGISTERED, DEVICE_REVOKED } from '@ecoswift/event-bus';
import { SecurityEventService } from '../../security/services/security-event.service';
import { SessionService } from './session.service';

export interface DeviceContext {
  userAgent?: string;
  ipAddress: string;
}

export interface RecognizedDevice {
  deviceId: string;
  isNewDevice: boolean;
  isTrusted: boolean;
  deviceName: string;
}

/**
 * Device recognition (security-model.md § Device Trust): fingerprints a
 * device from its User-Agent, tracks it in `Device` (Phase 2B schema), and
 * reports whether this is the *first* time this fingerprint has been seen
 * for the user — the signal `AuthService` uses to decide whether to send a
 * new-device login alert.
 *
 * The fingerprint is a hash of the User-Agent string alone, not IP —
 * IP addresses change often (mobile networks, VPNs) and hashing IP into
 * the fingerprint would make the *same physical device* look new on every
 * network change, defeating the point. IP is still recorded per-session
 * and per-login (`Session.ipAddress`, `LoginHistory.ipAddress`, and now
 * `Device.lastIpAddress` — Phase 3C's device risk metadata) for audit and
 * risk signals, just not as part of what defines "the same device."
 *
 * New devices are registered **untrusted** — trust is a signal for a
 * future step-up-authentication decision (security-model.md), not enforced
 * as a login gate in this phase; tracking it now means that decision has
 * real historical data to act on once it does.
 */
@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly securityEvents: SecurityEventService,
    @Inject(FRAUD_HOOKS) private readonly fraudHooks: FraudHooksPort,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async recognize(userId: string, context: DeviceContext): Promise<RecognizedDevice> {
    const fingerprint = this.fingerprint(context.userAgent);
    const deviceName = this.describe(context.userAgent);

    const existing = await this.prisma.device.findUnique({
      where: { userId_deviceFingerprint: { userId, deviceFingerprint: fingerprint } },
    });

    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), lastIpAddress: context.ipAddress },
      });
      return {
        deviceId: existing.id,
        isNewDevice: false,
        isTrusted: existing.trustLevel === 'TRUSTED',
        deviceName: existing.deviceName ?? deviceName,
      };
    }

    const created = await this.prisma.device.create({
      data: {
        userId,
        deviceFingerprint: fingerprint,
        deviceName,
        platform: this.platform(context.userAgent),
        trustLevel: 'UNTRUSTED',
        lastIpAddress: context.ipAddress,
      },
    });

    // Fraud Detection Hooks (Phase 3C § Fraud Detection Hooks) — a real
    // extension-point call at the moment a new-device signal actually
    // exists. `NoopFraudHooksService` always returns `triggered: false`;
    // the risk score is still captured onto the device row either way, so
    // a future real implementation's history isn't empty on day one.
    const signal = await this.fraudHooks.evaluateNewDevice({
      userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceId: created.id,
      isNewDevice: true,
    });
    await this.prisma.device.update({
      where: { id: created.id },
      data: { riskScore: signal.score, riskMetadata: signal.metadata as never },
    });

    await this.securityEvents.record({
      userId,
      eventType: 'DEVICE_REGISTERED',
      deviceId: created.id,
      ipAddress: context.ipAddress,
      riskScore: signal.score,
    });
    await this.eventPublisher.publish({
      eventType: DEVICE_REGISTERED,
      producerContext: 'auth-service',
      payload: { userId, deviceId: created.id, ipAddress: context.ipAddress },
    });

    return { deviceId: created.id, isNewDevice: true, isTrusted: false, deviceName };
  }

  async listForUser(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /** Self-service "forget this device" — removes it from the user's device list. Does not itself end any session; a device with a still-active session simply gets re-registered (untrusted) the next time that session's traffic is seen, or ends when the session naturally expires/is revoked. For an immediate, session-killing action, use `revoke()` instead. */
  async remove(userId: string, deviceId: string): Promise<void> {
    await this.prisma.device.deleteMany({ where: { id: deviceId, userId } });
  }

  /**
   * Device Revocation (Phase 3C § Device Security) — the stronger action:
   * marks the device revoked (kept, not deleted, so the record and its
   * risk history survive for review) and immediately ends every active
   * session tied to it. This is what "I think this device is
   * compromised" should trigger, distinct from the softer `remove()`
   * self-cleanup above.
   */
  async revoke(userId: string, deviceId: string, reason: string): Promise<void> {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) return;

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: new Date(), revokedReason: reason, trustLevel: 'UNTRUSTED', trustedAt: null },
    });

    const sessions = await this.prisma.session.findMany({ where: { deviceId, status: 'ACTIVE' }, select: { id: true } });
    for (const session of sessions) {
      await this.sessionService.revoke(session.id, `DEVICE_REVOKED:${reason}`);
    }

    await this.securityEvents.record({ userId, eventType: 'DEVICE_REVOKED', deviceId, metadata: { reason, sessionsRevoked: sessions.length } });
    await this.eventPublisher.publish({
      eventType: DEVICE_REVOKED,
      producerContext: 'auth-service',
      payload: { userId, deviceId, reason },
    });
  }

  async trust(userId: string, deviceId: string): Promise<void> {
    await this.prisma.device.updateMany({
      where: { id: deviceId, userId },
      data: { trustLevel: 'TRUSTED', trustedAt: new Date() },
    });
    await this.securityEvents.record({ userId, eventType: 'DEVICE_TRUSTED', deviceId });
  }

  private fingerprint(userAgent?: string): string {
    return createHash('sha256').update(userAgent ?? 'unknown').digest('hex');
  }

  private describe(userAgent?: string): string {
    if (!userAgent) return 'Unknown device';
    const parsed = new UAParser(userAgent).getResult();
    const browser = parsed.browser.name ?? 'Unknown browser';
    const os = parsed.os.name ?? 'Unknown OS';
    return `${browser} on ${os}`;
  }

  private platform(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    return new UAParser(userAgent).getResult().os.name;
  }
}

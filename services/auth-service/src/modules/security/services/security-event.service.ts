import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@ecoswift/database';
import { MetricsService } from '@ecoswift/observability';

export interface RecordSecurityEventInput {
  userId?: string;
  eventType:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'LOCKOUT'
    | 'PASSWORD_CHANGED'
    | 'PASSWORD_RESET'
    | 'TWO_FA_ENABLED'
    | 'TWO_FA_DISABLED'
    | 'SUSPICIOUS_LOGIN'
    | 'DEVICE_TRUSTED'
    | 'SESSION_REVOKED'
    | 'TWO_FA_CHALLENGE_SUCCEEDED'
    | 'TWO_FA_CHALLENGE_FAILED'
    | 'BACKUP_CODE_USED'
    | 'BACKUP_CODES_REGENERATED'
    | 'STEP_UP_COMPLETED'
    | 'STEP_UP_FAILED'
    | 'DEVICE_REGISTERED'
    | 'DEVICE_REVOKED'
    | 'SUSPICIOUS_SESSION'
    | 'FRAUD_SIGNAL_DETECTED';
  deviceId?: string;
  ipAddress?: string;
  riskScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Structured Security Events (Phase 3C brief § Observability) — the one
 * place every security-relevant fact across MFA, device, session, and
 * fraud-hook code gets recorded, so `SecurityEvent` (Phase 2B schema,
 * dormant until this phase) and the `security_events_total` Prometheus
 * counter (`@ecoswift/observability`) both stay complete and consistent
 * without every call site remembering to touch two things separately.
 *
 * Deliberately a thin wrapper, not a queue or a batching layer — a
 * `SecurityEvent` write failing should surface immediately (it's a
 * `PrismaService` call like any other), not get silently dropped by a
 * fire-and-forget mechanism.
 */
@Injectable()
export class SecurityEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async record(input: RecordSecurityEventInput): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        deviceId: input.deviceId,
        ipAddress: input.ipAddress,
        riskScore: input.riskScore,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    this.metrics.securityEventsTotal.inc({ event_type: input.eventType });
  }
}

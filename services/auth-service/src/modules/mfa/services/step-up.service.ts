import { Inject, Injectable } from '@nestjs/common';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, STEP_UP_COMPLETED } from '@ecoswift/event-bus';
import { TokenService } from '../../auth/services/token.service';
import { MfaService, type MfaVerificationMethod } from './mfa.service';
import { SecurityEventService } from '../../security/services/security-event.service';

/**
 * Step-up Authentication (Phase 3C brief § Multi-Factor Authentication) —
 * an already-signed-in user re-proves an MFA factor to unlock a sensitive
 * action (disabling MFA, regenerating backup codes, ...) without needing
 * to fully sign out and back in. `MfaService.verifyFactor()` does the
 * actual code check (throws on failure — this class adds nothing to that
 * beyond recording the step-up-specific security event and minting the
 * resulting short-lived assertion).
 */
@Injectable()
export class StepUpService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly mfaService: MfaService,
    private readonly securityEvents: SecurityEventService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async completeStepUp(userId: string, sessionId: string, method: MfaVerificationMethod, code: string): Promise<string> {
    await this.mfaService.verifyFactor(userId, method, code);

    const token = await this.tokenService.issueStepUpToken(userId, sessionId);

    await this.securityEvents.record({ userId, eventType: 'STEP_UP_COMPLETED', metadata: { sessionId, method } });
    await this.eventPublisher.publish({
      eventType: STEP_UP_COMPLETED,
      producerContext: 'auth-service',
      payload: { userId, sessionId },
    });

    return token;
  }
}

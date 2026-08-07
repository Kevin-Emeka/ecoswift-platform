import { StepUpService } from './step-up.service';
import type { TokenService } from '../../auth/services/token.service';
import type { MfaService } from './mfa.service';
import type { SecurityEventService } from '../../security/services/security-event.service';
import type { EventPublisherPort } from '@ecoswift/event-bus';

describe('StepUpService', () => {
  let tokenService: jest.Mocked<Pick<TokenService, 'issueStepUpToken'>>;
  let mfaService: jest.Mocked<Pick<MfaService, 'verifyFactor'>>;
  let securityEvents: jest.Mocked<Pick<SecurityEventService, 'record'>>;
  let eventPublisher: { publish: jest.Mock };
  let service: StepUpService;

  beforeEach(() => {
    tokenService = { issueStepUpToken: jest.fn().mockResolvedValue('step-up-jwt') };
    mfaService = { verifyFactor: jest.fn().mockResolvedValue(undefined) };
    securityEvents = { record: jest.fn().mockResolvedValue(undefined) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new StepUpService(
      tokenService as unknown as TokenService,
      mfaService as unknown as MfaService,
      securityEvents as unknown as SecurityEventService,
      eventPublisher as unknown as EventPublisherPort,
    );
  });

  it('verifies the factor before issuing a step-up token', async () => {
    await service.completeStepUp('user-1', 'session-1', 'TOTP', '595677');
    expect(mfaService.verifyFactor).toHaveBeenCalledWith('user-1', 'TOTP', '595677');
    expect(tokenService.issueStepUpToken).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('propagates a verification failure without issuing a token', async () => {
    mfaService.verifyFactor.mockRejectedValue(new Error('invalid code'));
    await expect(service.completeStepUp('user-1', 'session-1', 'TOTP', '000000')).rejects.toThrow('invalid code');
    expect(tokenService.issueStepUpToken).not.toHaveBeenCalled();
  });

  it('records STEP_UP_COMPLETED and publishes the domain event on success', async () => {
    const token = await service.completeStepUp('user-1', 'session-1', 'TOTP', '595677');
    expect(token).toBe('step-up-jwt');
    expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'STEP_UP_COMPLETED' }));
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'security.step_up_completed' }));
  });
});

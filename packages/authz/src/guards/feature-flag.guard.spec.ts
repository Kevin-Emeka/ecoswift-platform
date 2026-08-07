import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { FeatureFlagService } from '@ecoswift/config';
import { FeatureFlagGuard } from './feature-flag.guard';

function makeContext(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: userId ? { userId } : undefined }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('FeatureFlagGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let featureFlags: jest.Mocked<Pick<FeatureFlagService, 'isEnabled'>>;
  let guard: FeatureFlagGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    featureFlags = { isEnabled: jest.fn() };
    guard = new FeatureFlagGuard(reflector as unknown as Reflector, featureFlags as unknown as FeatureFlagService);
  });

  it('allows the request through when the route declares no feature flag', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext('user-1'))).resolves.toBe(true);
    expect(featureFlags.isEnabled).not.toHaveBeenCalled();
  });

  it('allows through when the flag is enabled for this caller', async () => {
    reflector.getAllAndOverride.mockReturnValue('loans.instant_approval');
    featureFlags.isEnabled.mockResolvedValue(true);
    await expect(guard.canActivate(makeContext('user-1'))).resolves.toBe(true);
    expect(featureFlags.isEnabled).toHaveBeenCalledWith('loans.instant_approval', { subjectId: 'user-1' });
  });

  it('throws NotFoundException — not Forbidden — when the flag is disabled', async () => {
    reflector.getAllAndOverride.mockReturnValue('loans.instant_approval');
    featureFlags.isEnabled.mockResolvedValue(false);
    await expect(guard.canActivate(makeContext('user-1'))).rejects.toThrow(NotFoundException);
  });

  it('evaluates for an anonymous caller with an undefined subjectId rather than erroring', async () => {
    reflector.getAllAndOverride.mockReturnValue('some.flag');
    featureFlags.isEnabled.mockResolvedValue(true);
    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
    expect(featureFlags.isEnabled).toHaveBeenCalledWith('some.flag', { subjectId: undefined });
  });
});

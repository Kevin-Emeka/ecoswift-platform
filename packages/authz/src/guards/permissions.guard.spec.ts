import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PolicyEngineService } from '../services/policy-engine.service';

function makeContext(user?: { userId: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let policyEngine: jest.Mocked<Pick<PolicyEngineService, 'canAll'>>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    policyEngine = { canAll: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector, policyEngine as unknown as PolicyEngineService);
  });

  it('allows the request through when the route declares no required permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext({ userId: 'user-1' }))).resolves.toBe(true);
    expect(policyEngine.canAll).not.toHaveBeenCalled();
  });

  it('allows the request through for an empty permission list', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    await expect(guard.canActivate(makeContext({ userId: 'user-1' }))).resolves.toBe(true);
  });

  it('throws UnauthorizedException when permissions are required but there is no user on the request', async () => {
    reflector.getAllAndOverride.mockReturnValue(['roles:read']);
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(UnauthorizedException);
    expect(policyEngine.canAll).not.toHaveBeenCalled();
  });

  it('allows through when the policy engine grants every required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['roles:read', 'roles:update']);
    policyEngine.canAll.mockResolvedValue(true);
    await expect(guard.canActivate(makeContext({ userId: 'user-1' }))).resolves.toBe(true);
    expect(policyEngine.canAll).toHaveBeenCalledWith('user-1', ['roles:read', 'roles:update']);
  });

  it('throws ForbiddenException when the policy engine denies', async () => {
    reflector.getAllAndOverride.mockReturnValue(['roles:delete']);
    policyEngine.canAll.mockResolvedValue(false);
    await expect(guard.canActivate(makeContext({ userId: 'user-1' }))).rejects.toThrow(ForbiddenException);
  });
});

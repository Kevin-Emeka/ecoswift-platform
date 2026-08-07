import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { OwnershipGuard } from './ownership.guard';
import { PolicyEngineService } from '../services/policy-engine.service';
import type { AuthorizedRequest } from '../interfaces/authorized-request.interface';

function makeContext(request: AuthorizedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('OwnershipGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let policyEngine: jest.Mocked<Pick<PolicyEngineService, 'can'>>;
  let guard: OwnershipGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    policyEngine = { can: jest.fn() };
    guard = new OwnershipGuard(reflector as unknown as Reflector, policyEngine as unknown as PolicyEngineService);
  });

  it('allows the request through when the route declares no ownership requirement', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext({ user: { userId: 'user-1' } }))).resolves.toBe(true);
  });

  it('throws UnauthorizedException when there is no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resolveOwnerId: () => 'owner-1' });
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('allows when the caller owns the resource', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resolveOwnerId: () => 'user-1' });
    await expect(guard.canActivate(makeContext({ user: { userId: 'user-1' } }))).resolves.toBe(true);
  });

  it('denies when the caller does not own the resource and holds no bypass permission', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resolveOwnerId: () => 'someone-else' });
    await expect(guard.canActivate(makeContext({ user: { userId: 'user-1' } }))).rejects.toThrow(ForbiddenException);
  });

  it('denies when resolveOwnerId returns undefined — an unknown resource is never treated as "no check needed"', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resolveOwnerId: () => undefined });
    await expect(guard.canActivate(makeContext({ user: { userId: 'user-1' } }))).rejects.toThrow(ForbiddenException);
  });

  it('allows a non-owner through when they hold the configured bypass permission', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resolveOwnerId: () => 'someone-else', bypassPermission: 'customers:read' });
    policyEngine.can.mockResolvedValue(true);

    await expect(guard.canActivate(makeContext({ user: { userId: 'staff-1' } }))).resolves.toBe(true);
    // Ownership resolution is skipped entirely once the bypass is granted — resolveOwnerId's result never even matters here.
    expect(policyEngine.can).toHaveBeenCalledWith('staff-1', 'customers:read');
  });

  it('still enforces ownership when the bypass permission is not held', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resolveOwnerId: () => 'someone-else', bypassPermission: 'customers:read' });
    policyEngine.can.mockResolvedValue(false);

    await expect(guard.canActivate(makeContext({ user: { userId: 'staff-1' } }))).rejects.toThrow(ForbiddenException);
  });

  it('supports an async resolveOwnerId', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resolveOwnerId: async () => 'user-1' });
    await expect(guard.canActivate(makeContext({ user: { userId: 'user-1' } }))).resolves.toBe(true);
  });
});

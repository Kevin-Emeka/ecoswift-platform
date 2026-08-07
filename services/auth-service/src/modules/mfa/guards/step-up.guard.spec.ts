import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { StepUpGuard, STEP_UP_HEADER } from './step-up.guard';
import type { TokenService } from '../../auth/services/token.service';

function makeContext(user: { userId: string; sessionId: string } | undefined, headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, headers }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('StepUpGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let tokenService: jest.Mocked<Pick<TokenService, 'verifyStepUpToken'>>;
  let guard: StepUpGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    tokenService = { verifyStepUpToken: jest.fn() };
    guard = new StepUpGuard(reflector as unknown as Reflector, tokenService as unknown as TokenService);
  });

  it('allows the request through when the route declares no step-up requirement', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext({ userId: 'u1', sessionId: 's1' }, {}))).resolves.toBe(true);
  });

  it('throws UnauthorizedException when there is no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(makeContext(undefined, {}))).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when the step-up header is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(makeContext({ userId: 'u1', sessionId: 's1' }, {}))).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the token fails to verify', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    tokenService.verifyStepUpToken.mockRejectedValue(new Error('expired'));
    const context = makeContext({ userId: 'u1', sessionId: 's1' }, { [STEP_UP_HEADER]: 'bad-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when the token's session doesn't match the caller's session", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    tokenService.verifyStepUpToken.mockResolvedValue({ sub: 'u1', sessionId: 'a-different-session', tokenUse: 'step_up', jti: 'x' });
    const context = makeContext({ userId: 'u1', sessionId: 's1' }, { [STEP_UP_HEADER]: 'valid-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when the token's user doesn't match the caller", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    tokenService.verifyStepUpToken.mockResolvedValue({ sub: 'a-different-user', sessionId: 's1', tokenUse: 'step_up', jti: 'x' });
    const context = makeContext({ userId: 'u1', sessionId: 's1' }, { [STEP_UP_HEADER]: 'valid-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows through when the token is valid and matches both user and session', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    tokenService.verifyStepUpToken.mockResolvedValue({ sub: 'u1', sessionId: 's1', tokenUse: 'step_up', jti: 'x' });
    const context = makeContext({ userId: 'u1', sessionId: 's1' }, { [STEP_UP_HEADER]: 'valid-token' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

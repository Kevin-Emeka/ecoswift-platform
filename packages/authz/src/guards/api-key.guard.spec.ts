import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import type { ApiKeyValidatorPort, ValidatedApiKey } from '../interfaces/api-key-validator.port';

function makeContext(headers: Record<string, string | undefined>): ExecutionContext {
  const request = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let validator: jest.Mocked<ApiKeyValidatorPort>;
  let guard: ApiKeyGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    validator = { validate: jest.fn() };
    guard = new ApiKeyGuard(reflector as unknown as Reflector, validator);
  });

  it('allows the request through when the route declares no required scopes', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext({}))).resolves.toBe(true);
    expect(validator.validate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no key header is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(['reports:read']);
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the key does not validate', async () => {
    reflector.getAllAndOverride.mockReturnValue(['reports:read']);
    validator.validate.mockResolvedValue(undefined);
    await expect(guard.canActivate(makeContext({ 'x-api-key': 'esb_live_bogus' }))).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when the key lacks a required scope', async () => {
    reflector.getAllAndOverride.mockReturnValue(['reports:read', 'reports:export']);
    const validated: ValidatedApiKey = { id: 'key-1', scopes: ['reports:read'] };
    validator.validate.mockResolvedValue(validated);
    await expect(guard.canActivate(makeContext({ 'x-api-key': 'esb_live_x' }))).rejects.toThrow(ForbiddenException);
  });

  it('allows through and attaches the validated key when every scope is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(['reports:read']);
    const validated: ValidatedApiKey = { id: 'key-1', scopes: ['reports:read', 'accounts:read'] };
    validator.validate.mockResolvedValue(validated);

    const request = { headers: { 'x-api-key': 'esb_live_x' } } as unknown as { headers: Record<string, string>; apiKey?: ValidatedApiKey };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.apiKey).toEqual(validated);
  });
});

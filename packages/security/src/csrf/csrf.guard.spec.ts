import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.service';

function makeContext(cookies: Record<string, string>, headers: Record<string, string | string[]>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ cookies, headers }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: CsrfGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new CsrfGuard(reflector as unknown as Reflector);
  });

  it('allows the request through when the route declares no CSRF requirement', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({}, {}))).toBe(true);
  });

  it('throws when neither the cookie nor the header is present', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(() => guard.canActivate(makeContext({}, {}))).toThrow(ForbiddenException);
  });

  it('throws when the header is missing but the cookie is present', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(() => guard.canActivate(makeContext({ [CSRF_COOKIE_NAME]: 'token-abc' }, {}))).toThrow(ForbiddenException);
  });

  it('throws when the header value does not match the cookie', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = makeContext({ [CSRF_COOKIE_NAME]: 'token-abc' }, { [CSRF_HEADER_NAME]: 'token-xyz' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows through when the header exactly matches the cookie', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = makeContext({ [CSRF_COOKIE_NAME]: 'token-abc' }, { [CSRF_HEADER_NAME]: 'token-abc' });
    expect(guard.canActivate(context)).toBe(true);
  });
});

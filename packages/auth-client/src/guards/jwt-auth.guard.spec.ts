import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  function makeContext(): ExecutionContext {
    return { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
  }

  it('bypasses passport authentication for routes marked @Public()', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('delegates to passport authentication for routes that are not public', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    const basePrototype = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: () => boolean };
    const superCanActivate = jest.spyOn(basePrototype, 'canActivate').mockReturnValue(true);

    const context = makeContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(superCanActivate).toHaveBeenCalledWith(context);

    superCanActivate.mockRestore();
  });
});

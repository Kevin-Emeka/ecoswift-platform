import { ForbiddenException } from '@nestjs/common';
import { PolicyEngineService } from './policy-engine.service';
import type { PermissionResolverPort } from '../interfaces/permission-resolver.port';

describe('PolicyEngineService', () => {
  let resolver: jest.Mocked<PermissionResolverPort>;
  let service: PolicyEngineService;

  beforeEach(() => {
    resolver = {
      getEffectivePermissions: jest.fn(),
      invalidate: jest.fn(),
    };
    service = new PolicyEngineService(resolver);
  });

  describe('can / canAll', () => {
    it('allows when the user holds the single required permission', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set(['accounts:read']));
      await expect(service.can('user-1', 'accounts:read')).resolves.toBe(true);
    });

    it('denies when the user lacks the permission', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set(['accounts:read']));
      await expect(service.can('user-1', 'accounts:freeze')).resolves.toBe(false);
    });

    it('requires every listed permission (AND semantics)', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set(['accounts:read']));
      await expect(service.canAll('user-1', ['accounts:read', 'accounts:freeze'])).resolves.toBe(false);

      resolver.getEffectivePermissions.mockResolvedValue(new Set(['accounts:read', 'accounts:freeze']));
      await expect(service.canAll('user-1', ['accounts:read', 'accounts:freeze'])).resolves.toBe(true);
    });

    it('trivially allows an empty requirement list', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set());
      await expect(service.canAll('user-1', [])).resolves.toBe(true);
      expect(resolver.getEffectivePermissions).not.toHaveBeenCalled();
    });
  });

  describe('canAny', () => {
    it('allows when the user holds at least one listed permission', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set(['loans:read']));
      await expect(service.canAny('user-1', ['loans:approve', 'loans:read'])).resolves.toBe(true);
    });

    it('denies when the user holds none of the listed permissions', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set(['loans:read']));
      await expect(service.canAny('user-1', ['loans:approve', 'loans:disburse'])).resolves.toBe(false);
    });
  });

  describe('assertCan', () => {
    it('resolves silently when allowed', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set(['roles:assign']));
      await expect(service.assertCan('user-1', 'roles:assign')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when denied', async () => {
      resolver.getEffectivePermissions.mockResolvedValue(new Set());
      await expect(service.assertCan('user-1', 'roles:assign')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('default-deny on resolver failure', () => {
    it('treats a resolver error as zero permissions rather than propagating the error', async () => {
      resolver.getEffectivePermissions.mockRejectedValue(new Error('database unreachable'));
      await expect(service.can('user-1', 'accounts:read')).resolves.toBe(false);
    });

    it('never lets an infrastructure failure fail open', async () => {
      resolver.getEffectivePermissions.mockRejectedValue(new Error('cache exploded'));
      await expect(service.canAll('user-1', ['users:delete', 'roles:delete'])).resolves.toBe(false);
    });
  });
});

import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { ApiKeyValidatorPort, ValidatedApiKey } from '../interfaces/api-key-validator.port';

/**
 * Looks up an `ApiKey` (`prisma/schema.prisma`) by the SHA-256 hash of the
 * raw key presented on the request — the same "never persist the secret
 * itself" pattern `auth-service`'s `TokenService`/`OtpService` use for
 * refresh tokens and verification codes. A key that's expired or not
 * `ACTIVE` resolves to `undefined`, identically to a key that doesn't
 * exist at all — `ApiKeyGuard` doesn't need to distinguish "wrong key" from
 * "right key, but revoked" to decide the outcome, only to log it.
 */
@Injectable()
export class ApiKeyValidatorService implements ApiKeyValidatorPort {
  constructor(private readonly prisma: PrismaService) {}

  async validate(rawKey: string): Promise<ValidatedApiKey | undefined> {
    const keyHash = this.hash(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } });

    if (!apiKey || apiKey.status !== 'ACTIVE') return undefined;
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return undefined;

    void this.prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {
      // Best-effort — a failed lastUsedAt bump must never fail the request it's tracking.
    });

    return { id: apiKey.id, scopes: apiKey.scopes, ownerUserId: apiKey.ownerUserId ?? undefined };
  }

  private hash(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}

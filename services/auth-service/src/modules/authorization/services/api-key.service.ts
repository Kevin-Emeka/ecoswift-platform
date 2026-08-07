import { createHash, randomBytes } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { EventPublisherPort } from '@ecoswift/event-bus';
import { EVENT_PUBLISHER, API_KEY_CREATED, API_KEY_REVOKED } from '@ecoswift/event-bus';
import { PERMISSION_CATALOG, permissionCode } from '@ecoswift/authz';
import { AuthorizationAuditService } from './authorization-audit.service';

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  ownerUserId?: string;
  expiresAt?: Date;
}

const VALID_SCOPE_CODES = new Set(PERMISSION_CATALOG.map((p) => permissionCode(p.resource, p.action)));
const KEY_PREFIX = 'esb_live_';

/**
 * API key issuance — the credential half of Scope-Based Authorization
 * (docs/authorization.md § Scope-Based Authorization; `ApiKeyGuard` in
 * `@ecoswift/authz` is the enforcement half). The raw key is generated
 * here, returned to the caller **exactly once**, and never stored or
 * logged anywhere in recoverable form — only its SHA-256 hash persists
 * (`ApiKey.keyHash`), the same "never persist the secret" pattern
 * `auth-service`'s `TokenService`/`OtpService` already use.
 */
@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuthorizationAuditService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async list() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        ownerUserId: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: CreateApiKeyInput, actorUserId: string): Promise<{ id: string; rawKey: string }> {
    const invalidScopes = input.scopes.filter((scope) => !VALID_SCOPE_CODES.has(scope));
    if (invalidScopes.length > 0) {
      throw new ForbiddenException(`Unknown scope(s): ${invalidScopes.join(', ')}`);
    }

    const rawSecret = randomBytes(32).toString('base64url');
    const rawKey = `${KEY_PREFIX}${rawSecret}`;
    const keyHash = this.hash(rawKey);
    const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 8);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: input.name,
        keyHash,
        keyPrefix,
        scopes: input.scopes,
        ownerUserId: input.ownerUserId,
        expiresAt: input.expiresAt,
      },
    });

    await this.audit.record({
      actorUserId,
      actionType: 'CREATE',
      resourceType: 'API_KEY',
      resourceId: apiKey.id,
      description: `API key "${apiKey.name}" created with scopes: ${input.scopes.join(', ')}`,
      afterState: { name: apiKey.name, scopes: input.scopes, keyPrefix },
    });
    await this.eventPublisher.publish({
      eventType: API_KEY_CREATED,
      producerContext: 'auth-service',
      payload: { apiKeyId: apiKey.id, ownerUserId: input.ownerUserId, scopes: input.scopes, createdBy: actorUserId },
    });

    return { id: apiKey.id, rawKey };
  }

  async revoke(id: string, actorUserId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) throw new NotFoundException('API key not found');
    if (apiKey.status === 'REVOKED') return;

    await this.prisma.apiKey.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date() } });

    await this.audit.record({
      actorUserId,
      actionType: 'UPDATE',
      resourceType: 'API_KEY',
      resourceId: id,
      description: `API key "${apiKey.name}" revoked`,
      beforeState: { status: apiKey.status },
      afterState: { status: 'REVOKED' },
    });
    await this.eventPublisher.publish({
      eventType: API_KEY_REVOKED,
      producerContext: 'auth-service',
      payload: { apiKeyId: id, revokedBy: actorUserId },
    });
  }

  private hash(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}

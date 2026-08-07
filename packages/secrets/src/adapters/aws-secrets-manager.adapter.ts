import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { SecretsManagerPort } from '../ports/secrets-manager.port';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Production-shaped adapter over AWS Secrets Manager. Caches resolved
 * values in-process with a short TTL — every request re-fetching a secret
 * from AWS on every use would add latency and run into API rate limits at
 * "millions of users" scale, but a TTL (rather than caching forever) means
 * a rotated secret is picked up within `cacheTtlMs` without requiring every
 * running instance to restart.
 */
export class AwsSecretsManagerAdapter implements SecretsManagerPort {
  private readonly client: SecretsManagerClient;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    region: string,
    private readonly cacheTtlMs = 5 * 60 * 1000,
  ) {
    this.client = new SecretsManagerClient({ region });
  }

  async getSecret(name: string): Promise<string> {
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    return this.refreshSecret(name);
  }

  async refreshSecret(name: string): Promise<string> {
    const response = await this.client.send(new GetSecretValueCommand({ SecretId: name }));
    const value = response.SecretString;
    if (!value) {
      throw new Error(`Secret "${name}" has no string value`);
    }

    this.cache.set(name, { value, expiresAt: Date.now() + this.cacheTtlMs });
    return value;
  }
}

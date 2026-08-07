import type { SecretsManagerPort } from '../ports/secrets-manager.port';

/**
 * Development-default adapter: reads secrets from `process.env` (i.e. from
 * `.env`, gitignored — see Phase 1's `.env.example`). Never appropriate for
 * staging/production, where `SECRETS_DRIVER=aws` should be set instead.
 */
export class EnvSecretsAdapter implements SecretsManagerPort {
  async getSecret(name: string): Promise<string> {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Secret "${name}" is not set in the environment`);
    }
    return value;
  }

  async refreshSecret(name: string): Promise<string> {
    // process.env doesn't change without a process restart, so "refresh" is
    // just a re-read — there's nothing to invalidate.
    return this.getSecret(name);
  }
}

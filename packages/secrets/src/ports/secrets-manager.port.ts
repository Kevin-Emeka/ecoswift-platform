/**
 * Secrets manager abstraction (security-model.md § Secrets Management: "no
 * secret is ever committed to source control... production secrets are
 * sourced from a dedicated secrets manager, injected at deploy/runtime").
 *
 * Deliberately **not** backed by `@ecoswift/cache`/Redis — a secret (e.g.
 * the Redis password itself) may need to be resolved before Redis is
 * reachable, so this package caches in-process memory only, never a shared
 * store.
 */
export interface SecretsManagerPort {
  getSecret(name: string): Promise<string>;
  /** Bypasses the in-memory cache — used after a known/suspected rotation. */
  refreshSecret(name: string): Promise<string>;
}

export const SECRETS_MANAGER = Symbol('SECRETS_MANAGER');

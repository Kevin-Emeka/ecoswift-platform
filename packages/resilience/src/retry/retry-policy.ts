import { Logger } from '@nestjs/common';

export interface RetryPolicyOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Adds up to ±20% random jitter to each delay, to avoid many callers retrying in lockstep. */
  jitter?: boolean;
  /** Return false to stop retrying immediately (e.g. a 4xx validation error should never be retried). Defaults to retrying everything. */
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

const logger = new Logger('RetryPolicy');

/**
 * Exponential backoff with jitter and a retryability predicate — the
 * superset of `@ecoswift/utils`' plain `retry()` that resilience-sensitive
 * call sites (outbound HTTP, payment rails, third-party gateways) should
 * use instead. `@ecoswift/utils`' version stays as the dependency-free
 * primitive for packages that can't take a dependency on this one.
 */
export async function withRetryPolicy<T>(
  fn: () => Promise<T>,
  options: RetryPolicyOptions = {},
): Promise<T> {
  const {
    retries = 3,
    minDelayMs = 100,
    maxDelayMs = 2000,
    jitter = true,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries || !shouldRetry(error)) {
        throw error;
      }

      const baseDelay = Math.min(minDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const delay = jitter ? baseDelay * (0.8 + Math.random() * 0.4) : baseDelay;

      onRetry?.(error, attempt);
      logger.debug(`Retry attempt ${attempt}/${retries} after ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  /** Milliseconds before a call is considered timed out. */
  timeoutMs?: number;
  /** % of failed requests (0-100) before the circuit opens. */
  errorThresholdPercentage?: number;
  /** Milliseconds the circuit stays open before allowing a trial request. */
  resetTimeoutMs?: number;
  /** Minimum number of requests in the rolling window before tripping is possible. */
  volumeThreshold?: number;
  /** Called when a call is rejected because the circuit is open — usually where a fallback is wired in. */
  fallback?: (...args: unknown[]) => unknown;
}

/**
 * Creates and caches named circuit breakers (opossum) so the same logical
 * dependency (e.g. "core-banking-payment-rail", "sms-provider") shares one
 * breaker across every call site rather than each call site tripping its
 * own independent breaker and never actually protecting the dependency as a
 * whole.
 */
@Injectable()
export class CircuitBreakerFactory {
  private readonly logger = new Logger(CircuitBreakerFactory.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  getOrCreate<TArgs extends unknown[], TResult>(
    name: string,
    action: (...args: TArgs) => Promise<TResult>,
    options: CircuitBreakerOptions = {},
  ): CircuitBreaker<TArgs, TResult> {
    const existing = this.breakers.get(name);
    if (existing) {
      return existing as CircuitBreaker<TArgs, TResult>;
    }

    const breaker = new CircuitBreaker(action, {
      name,
      timeout: options.timeoutMs ?? 5000,
      errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
      resetTimeout: options.resetTimeoutMs ?? 30_000,
      volumeThreshold: options.volumeThreshold ?? 5,
    });

    if (options.fallback) {
      breaker.fallback(options.fallback);
    }

    breaker.on('open', () => this.logger.warn(`Circuit "${name}" opened — failing fast`));
    breaker.on('halfOpen', () => this.logger.log(`Circuit "${name}" half-open — trial request allowed`));
    breaker.on('close', () => this.logger.log(`Circuit "${name}" closed — dependency recovered`));

    this.breakers.set(name, breaker);
    return breaker as CircuitBreaker<TArgs, TResult>;
  }

  /** Fire a named breaker, creating it on first use — the common one-liner call shape. */
  async fire<TArgs extends unknown[], TResult>(
    name: string,
    action: (...args: TArgs) => Promise<TResult>,
    args: TArgs,
    options?: CircuitBreakerOptions,
  ): Promise<TResult> {
    const breaker = this.getOrCreate(name, action, options);
    return breaker.fire(...args);
  }
}

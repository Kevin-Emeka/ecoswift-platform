import { withRetryPolicy, type RetryPolicyOptions } from './retry-policy';

/**
 * Method decorator applying `withRetryPolicy` around every call to an async
 * method — for the common case of "wrap this whole method in retry logic"
 * without a manual `withRetryPolicy(() => this.thing(), ...)` at every call
 * site.
 */
export function Retryable(options: RetryPolicyOptions = {}): MethodDecorator {
  return (_target, _propertyKey, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      return withRetryPolicy(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

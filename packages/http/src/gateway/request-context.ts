import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  correlationId?: string;
  requestId?: string;
  actorId?: string;
  actorType?: 'customer' | 'staff' | 'system';
}

/**
 * `AsyncLocalStorage`-backed request context — makes `correlationId`,
 * `requestId`, and the acting user available anywhere in a request's async
 * call chain (a deeply-nested domain service, a logger, an error handler)
 * without threading them through every function signature. Populated once
 * per request by `RequestContextMiddleware`, read via `RequestContext.get()`.
 */
export class RequestContext {
  private static readonly storage = new AsyncLocalStorage<RequestContextStore>();

  static run<T>(store: RequestContextStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }

  static get(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  static get correlationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  static get requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}

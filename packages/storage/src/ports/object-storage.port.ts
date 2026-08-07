export interface PutObjectOptions {
  contentType?: string;
  /** Server-side metadata tags, e.g. `{ kycApplicationId: '...' }` for KYC documents. */
  metadata?: Record<string, string>;
}

/**
 * S3-compatible object storage abstraction. Every consumer (statement
 * generation, receipt generation, KYC document upload) depends on this
 * port, never on the AWS SDK directly — the same adapters swap between a
 * real S3 bucket in production and local disk in development without any
 * calling code changing (`STORAGE_DRIVER` env var, see
 * `packages/config/src/env.schema.ts`).
 */
export interface ObjectStoragePort {
  put(key: string, body: Buffer | Uint8Array | string, options?: PutObjectOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** A time-limited URL for direct client access (e.g. downloading a statement) without proxying the bytes through a service. */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

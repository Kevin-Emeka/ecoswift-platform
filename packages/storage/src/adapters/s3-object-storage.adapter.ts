import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStoragePort, PutObjectOptions } from '../ports/object-storage.port';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** Set for S3-compatible providers (MinIO, DigitalOcean Spaces, etc.) — omit for real AWS S3. */
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Required by most S3-compatible servers (MinIO); AWS S3 itself doesn't need it. */
  forcePathStyle?: boolean;
}

/**
 * Works against real AWS S3 *and* any S3-compatible server (MinIO,
 * DigitalOcean Spaces, Cloudflare R2) via the same client — only
 * `endpoint`/`forcePathStyle` differ, both are plain config, not code.
 */
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });
  }

  async put(key: string, body: Buffer | Uint8Array | string, options: PutObjectOptions = {}): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        Metadata: options.metadata,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Object "${key}" has no body`);
    }
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return false;
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

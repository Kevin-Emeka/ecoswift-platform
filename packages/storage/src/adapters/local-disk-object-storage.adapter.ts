import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ObjectStoragePort } from '../ports/object-storage.port';

/**
 * Local-filesystem object storage — the `STORAGE_DRIVER=local` default for
 * development, so a fresh checkout works without provisioning real S3/MinIO
 * credentials. **Not for production**: `getSignedUrl` here returns a plain
 * `file://` path with no access control or real expiry, since there's no
 * storage server to issue a genuinely time-limited URL against — it exists
 * only so code written against `ObjectStoragePort` behaves identically in
 * dev, not because it's a real security boundary.
 */
export class LocalDiskObjectStorageAdapter implements ObjectStoragePort {
  constructor(private readonly rootPath: string) {}

  async put(key: string, body: Buffer | Uint8Array | string): Promise<void> {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    return `file://${this.resolve(key)}`;
  }

  private resolve(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
    return path.join(this.rootPath, normalized);
  }
}

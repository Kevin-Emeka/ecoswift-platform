import { type DynamicModule, Global, Module } from '@nestjs/common';
import { S3ObjectStorageAdapter } from './adapters/s3-object-storage.adapter';
import { LocalDiskObjectStorageAdapter } from './adapters/local-disk-object-storage.adapter';
import { OBJECT_STORAGE } from './ports/object-storage.port';

/**
 * Selects the `ObjectStoragePort` adapter from `STORAGE_DRIVER`
 * (`packages/config/src/env.schema.ts`): `s3` (real S3 or an S3-compatible
 * server) in staging/production, `local` (filesystem) by default for
 * development.
 */
@Global()
@Module({})
export class StorageModule {
  static forRoot(): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: OBJECT_STORAGE,
          useFactory: () => {
            if (process.env.STORAGE_DRIVER === 's3') {
              return new S3ObjectStorageAdapter({
                bucket: process.env.STORAGE_S3_BUCKET ?? '',
                region: process.env.STORAGE_S3_REGION ?? 'us-east-1',
                endpoint: process.env.STORAGE_S3_ENDPOINT,
                accessKeyId: process.env.STORAGE_S3_ACCESS_KEY,
                secretAccessKey: process.env.STORAGE_S3_SECRET_KEY,
                forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
              });
            }
            return new LocalDiskObjectStorageAdapter(process.env.STORAGE_LOCAL_PATH ?? './.storage');
          },
        },
      ],
      exports: [OBJECT_STORAGE],
    };
  }
}

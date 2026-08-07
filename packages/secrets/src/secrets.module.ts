import { type DynamicModule, Global, Module } from '@nestjs/common';
import { EnvSecretsAdapter } from './adapters/env-secrets.adapter';
import { AwsSecretsManagerAdapter } from './adapters/aws-secrets-manager.adapter';
import { SECRETS_MANAGER } from './ports/secrets-manager.port';

/** Selects the adapter from `SECRETS_DRIVER` (`env` default, `aws` for staging/production). */
@Global()
@Module({})
export class SecretsModule {
  static forRoot(): DynamicModule {
    return {
      module: SecretsModule,
      providers: [
        {
          provide: SECRETS_MANAGER,
          useFactory: () => {
            if (process.env.SECRETS_DRIVER === 'aws') {
              return new AwsSecretsManagerAdapter(process.env.SECRETS_AWS_REGION ?? 'us-east-1');
            }
            return new EnvSecretsAdapter();
          },
        },
      ],
      exports: [SECRETS_MANAGER],
    };
  }
}

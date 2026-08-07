// OpenTelemetry auto-instrumentation must patch modules before anything else
// requires them — this import (and the call immediately below) must stay
// the very first thing in this file, ahead of every other import, because
// the compiled CommonJS `require()` order follows source order exactly.
// See @ecoswift/observability's tracing.ts doc comment for why.
import { startTracing } from '@ecoswift/observability';
startTracing('ecoswift-api');

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
}

bootstrap();

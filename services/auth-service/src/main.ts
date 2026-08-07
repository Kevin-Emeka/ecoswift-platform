import { startTracing } from '@ecoswift/observability';
startTracing('ecoswift-auth-service');

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { buildHelmetOptions, buildCorsOptions, applyBodySizeLimits } from '@ecoswift/security';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // `bodyParser: false` — Nest's platform-express otherwise installs its
  // own unlimited-by-default JSON/urlencoded parsers before this function
  // ever runs; `applyBodySizeLimits()` below is what actually replaces
  // them with an explicit, environment-aware ceiling (Phase 3C § Request
  // Size Limits).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv');

  applyBodySizeLimits(app, configService.get<string>('requestBodyLimit') ?? '100kb');
  app.use(helmet(buildHelmetOptions()));
  app.use(cookieParser());
  app.enableCors(buildCorsOptions(configService.get<string>('cors.allowedOrigins')));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger/OpenAPI — never exposed in production (api-guidelines.md's
  // versioned REST surface is the public contract; the interactive explorer
  // is a development/staging convenience, not something to ship live).
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Ecoswift Bank — Identity, Authorization & Security API')
      .setDescription(
        'Registration, login, session, and device management (docs/authentication.md); role-based access control, permissions, API keys, and feature flags (docs/authorization.md); and multi-factor authentication, device security, and step-up authentication (docs/mfa.md, docs/device-security.md) for Ecoswift Bank.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth', 'Registration, login, logout, tokens, password reset')
      .addTag('sessions', 'Session listing and revocation')
      .addTag('devices', 'Device listing, trust, and revocation')
      .addTag('authorization', 'Roles, permissions, role assignment, approvals, API keys, feature flags')
      .addTag('mfa', 'TOTP/SMS/EMAIL enrollment, login-time verification, step-up authentication')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
}

bootstrap();

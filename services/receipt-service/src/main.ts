import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { buildHelmetOptions, buildCorsOptions } from '@ecoswift/security';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv');

  app.use(helmet(buildHelmetOptions()));
  app.enableCors(buildCorsOptions(configService.get<string>('cors.allowedOrigins')));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Ecoswift Bank — Receipts API')
      .setDescription('Sandbox transaction receipt retrieval; RECEIPTS_QUEUE consumer runs in the background.')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('receipts', 'Receipt retrieval for a caller-owned transaction')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
}

bootstrap();

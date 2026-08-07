import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { CORRELATION_ID_HEADER } from '@ecoswift/shared';

/**
 * Structured JSON logging via Pino. In development, output is piped through
 * pino-pretty for readability; in production/staging it stays raw JSON so it
 * can be ingested by a log aggregator.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        customProps: (req) => ({
          correlationId: req.headers[CORRELATION_ID_HEADER],
        }),
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}

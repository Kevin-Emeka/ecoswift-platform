import type {
  ArgumentsHost,
  ExceptionFilter} from '@nestjs/common';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from '@ecoswift/shared';
import type { ApiErrorResponse } from '@ecoswift/types';

/** Translates any thrown error (HttpException, DomainException, or unknown) into ApiErrorResponse. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, code, message, details } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      error: { code, message, details },
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof DomainException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string' ? response : ((response as { message?: string }).message ?? exception.message);
      return {
        statusCode: exception.getStatus(),
        code: exception.constructor.name,
        message: Array.isArray(message) ? message.join(', ') : message,
        details: typeof response === 'object' ? response : undefined,
      };
    }

    // Phase 3C § Request Size Limits — `express.json()`/`urlencoded()`
    // (via `raw-body`) reject an over-limit body by throwing a plain
    // `Error` with `.status`/`.type` set, not an `HttpException` — without
    // this, an oversized payload surfaced as a generic, alarming 500
    // instead of the clean, expected 413 it actually is.
    if (this.isPayloadTooLarge(exception)) {
      return {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        code: 'PayloadTooLargeException',
        message: 'Request body exceeds the maximum allowed size',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private isPayloadTooLarge(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;
    const err = exception as Error & { status?: number; statusCode?: number; type?: string };
    return err.status === 413 || err.statusCode === 413 || err.type === 'entity.too.large';
  }
}

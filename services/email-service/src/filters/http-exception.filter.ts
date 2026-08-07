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

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }
}

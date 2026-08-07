import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor} from '@nestjs/common';
import {
  Injectable,
  Logger
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable} from 'rxjs';
import { tap } from 'rxjs';

/** Logs method, path, status code, and duration for every HTTP request. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        this.logger.log(`${method} ${originalUrl} ${response.statusCode} +${durationMs}ms`);
      }),
    );
  }
}

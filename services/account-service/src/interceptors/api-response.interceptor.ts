import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import type { ApiResponse } from '@ecoswift/types';

/**
 * Wraps every successful controller return value in the standard envelope
 * `docs/api-guidelines.md` § Response Format defines (`{ success: true,
 * data, timestamp }`) — the Phase 4A brief's "Standard response format"
 * deliverable. Applied per-controller (`@UseInterceptors`), not globally:
 * `/health` and `/metrics` (Terminus/Prometheus shapes consumed by
 * infrastructure, not API clients) must stay unwrapped.
 */
@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

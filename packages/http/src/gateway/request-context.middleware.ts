import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@ecoswift/shared';
import { RequestContext } from './request-context';

/**
 * Populates `RequestContext` for the lifetime of one request. Must run
 * after `CorrelationIdMiddleware`/`RequestIdMiddleware`
 * (`@ecoswift/observability`) in the middleware chain, since it reads the
 * headers they set.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    RequestContext.run(
      {
        correlationId: req.header(CORRELATION_ID_HEADER),
        requestId: req.header(REQUEST_ID_HEADER),
      },
      next,
    );
  }
}

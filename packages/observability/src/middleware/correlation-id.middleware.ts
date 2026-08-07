import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_HEADER } from '@ecoswift/shared';

/**
 * Canonical, shared version of the correlation-id middleware every Phase 1
 * app scaffolded its own copy of (see e.g.
 * `apps/api/src/middleware/correlation-id.middleware.ts`, since removed in
 * favor of this shared package). Propagates an existing `x-correlation-id`
 * across a whole request chain —
 * client → gateway → service → event → worker — generating one only at the
 * chain's true origin. Distinct from `RequestIdMiddleware`: a correlation id
 * spans a whole logical operation across many hops; a request id identifies
 * one single hop.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}

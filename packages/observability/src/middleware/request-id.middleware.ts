import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '@ecoswift/shared';

/**
 * Identifies exactly one hop (one HTTP request to one service) — always
 * freshly generated, never propagated from an incoming header the way
 * `CorrelationIdMiddleware` propagates `x-correlation-id`. Useful for
 * correlating a specific log line/trace span/error report back to one
 * concrete request even when the broader correlation id spans many hops.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}

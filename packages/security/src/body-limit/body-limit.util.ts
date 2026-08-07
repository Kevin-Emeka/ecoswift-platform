import type { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';

/**
 * Request Size Limits — applied in place of Nest/Express's implicit
 * defaults so the ceiling is a control this deployment chose
 * (`REQUEST_BODY_LIMIT`), not an accident of whatever `express.json()`
 * defaults to. Must be called with `bodyParser: false` passed to
 * `NestFactory.create()` — otherwise Nest has already installed its own
 * unlimited-by-default parser before this ever runs.
 */
export function applyBodySizeLimits(app: INestApplication, limit: string): void {
  app.use(json({ limit }));
  app.use(urlencoded({ limit, extended: true }));
}

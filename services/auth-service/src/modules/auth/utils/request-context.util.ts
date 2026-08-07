import type { Request } from 'express';
import type { AuthRequestContext } from '../interfaces/auth-request-context.interface';

export function extractRequestContext(req: Request): AuthRequestContext {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.header('user-agent'),
  };
}

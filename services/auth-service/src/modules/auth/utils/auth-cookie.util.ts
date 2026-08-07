import type { Response } from 'express';
import { AUTH_COOKIE_NAME } from '../constants/auth.constants';

/**
 * Secure cookie support (security-model.md, this phase's brief): the
 * refresh token is set as an `httpOnly` (unreadable to page JavaScript —
 * defeats XSS token theft), `secure` (HTTPS-only in production),
 * `sameSite: 'strict'` (not sent on cross-site requests — defeats CSRF
 * against the refresh endpoint) cookie, in addition to being returned in
 * the response body. Body-returned tokens are for non-browser clients
 * (mobile apps) that can't rely on cookies; browser clients should prefer
 * the cookie and treat the body value as a fallback.
 */
export function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/v1/auth',
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/v1/auth' });
}

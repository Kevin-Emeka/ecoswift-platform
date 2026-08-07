import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { generateSecureToken } from '../crypto/secure-random.util';

export const CSRF_COOKIE_NAME = 'ecoswift_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Double-submit-cookie CSRF protection — defense in depth alongside
 * `authentication.md`'s `SameSite=Strict` refresh-token cookie, which is
 * already the primary mitigation (a strict-same-site cookie is never sent
 * on a cross-site request in the first place, browser-enforced). This adds
 * a second, independent layer for the specific case a `SameSite` policy
 * doesn't fully cover — an older browser, or a `SameSite=Lax`/`None`
 * relaxation some future integration might need.
 *
 * The CSRF cookie is deliberately **not** `httpOnly` — the whole point is
 * that only same-origin JS can read it (cross-site JS can't read another
 * site's cookies at all) and echo it back in a header, which a forged
 * cross-site form submission can never do since it can't read the cookie
 * to construct the header.
 */
@Injectable()
export class CsrfService {
  issueToken(res: Response, secure: boolean): string {
    const token = generateSecureToken(32);
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure,
      sameSite: 'strict',
      path: '/',
    });
    return token;
  }

  clearToken(res: Response): void {
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
  }
}

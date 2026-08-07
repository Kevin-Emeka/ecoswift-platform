/** Minimal shape `app.enableCors()` accepts — kept local rather than importing Nest's internal `cors` type path, which isn't a stable public export. */
export interface CorsOptions {
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
  credentials: boolean;
}

/**
 * CORS Configuration — replaces the Phase 3A-era `{ origin: true }`
 * (reflect-any-origin) with an explicit allow-list read from
 * `CORS_ALLOWED_ORIGINS` (comma-separated). Default-deny: an unset or
 * empty allow-list means **no** cross-origin browser caller is permitted,
 * not "allow everything" — the opposite failure direction from what
 * `origin: true` defaulted to.
 */
export function buildCorsOptions(allowedOriginsCsv: string | undefined): CorsOptions {
  const allowList = (allowedOriginsCsv ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    origin(requestOrigin, callback) {
      // Same-origin / non-browser requests (curl, server-to-server) carry no Origin header at all — never rejected on that basis alone.
      // A disallowed origin is denied via `callback(null, false)` — not an
      // Error — so the request completes as an ordinary response missing
      // `Access-Control-Allow-Origin` (which is what actually makes the
      // browser block reading it) rather than surfacing as a 500 from the
      // framework's generic error handling. A CORS policy rejection is an
      // expected, clean "no," not a server fault.
      callback(null, !requestOrigin || allowList.includes(requestOrigin));
    },
    credentials: true,
  };
}

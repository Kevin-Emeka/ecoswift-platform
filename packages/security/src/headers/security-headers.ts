import helmet from 'helmet';

/**
 * Security Headers — a stricter, explicit `helmet()` configuration rather
 * than the library's bare defaults every Phase 1 `main.ts` started with
 * (`app.use(helmet())`, no options). Explicit here because "whatever
 * helmet defaults to this version" is not a policy anyone actually chose;
 * this is.
 */
export function buildHelmetOptions(): Parameters<typeof helmet>[0] {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        // Swagger UI (non-production only, see main.ts) needs inline styles/scripts —
        // this policy applies API-wide, so it stays permissive enough for /docs to
        // render rather than special-casing that one route.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    noSniff: true,
    frameguard: { action: 'sameorigin' },
    xssFilter: true,
    hidePoweredBy: true,
  };
}

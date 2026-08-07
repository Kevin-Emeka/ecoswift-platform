# Ecoswift Bank — Security Overview (Identity & Authentication)

**Phase 3A deliverable.** The security mechanics underpinning `services/auth-service` that aren't a user-facing flow in their own right: password hashing, JWT design, rate limiting, audit/structured logging, input validation, error handling, and secure transport of credentials. Read alongside [`authentication.md`](authentication.md) (the flows) and [`session-management.md`](session-management.md) (session/device state) — this document is "how it's made secure," not "what it does."

It also names what this phase deliberately did **not** build, so nothing here is mistaken for a gap nobody noticed.

---

## Password hashing — Argon2id

`PasswordService` (`modules/auth/services/password.service.ts`) hashes with **Argon2id**, not bcrypt:

```
{ type: argon2.argon2id, memoryCost: 19456 /* 19 MiB */, timeCost: 2, parallelism: 1 }
```

These are OWASP's current baseline parameters for a general-purpose, non-hardware-backed server — conservative enough that hashing stays fast under real login load (it must not become its own denial-of-service vector) while remaining meaningfully more expensive to brute-force than bcrypt at equivalent settings. Argon2id was chosen over bcrypt because this is a new system with no legacy bcrypt hashes to migrate — there was no compatibility reason to prefer the older algorithm, and Argon2id is OWASP's recommended default for exactly this situation (resistant to both GPU parallelization, where bcrypt is weaker, and side-channel timing attacks, where scrypt-style algorithms are weaker).

The plaintext password never persists anywhere — not in the database, not in logs (see § Logging below), not in any event payload. `PasswordService.verify()` treats a malformed or foreign hash as "does not match" rather than letting Argon2's own exception propagate, so a corrupted or unexpected hash format fails closed.

### Password policy

Complexity (`validateComplexity`) and reuse (`isReusedPassword` against `PasswordHistory`, default last 5 hashes) are both **Configuration-driven** (`ConfigurationService`, database-backed, staff-editable without a deploy), falling back to `AUTH_DEFAULTS` if a setting is unset. This is deliberately not hardcoded — see `business-rules.md` § Password Policy for why the threshold needs to be adjustable independent of a release cycle.

## JWT design

`TokenService` signs and verifies two structurally distinct token kinds with **separate secrets** (`JWT_SECRET` / `JWT_REFRESH_SECRET`, both in `packages/config/src/env.schema.ts` since Phase 1):

- **Access token**: `{ sub, sessionId, actorType, tokenUse: 'access', jti }`, short-lived (`access_token.ttl_minutes`, default 15).
- **Refresh token**: `{ sub, sessionId, tokenUse: 'refresh', jti }`, longer-lived (`refresh_token.ttl_days`, default 7, or 30 with `rememberMe`).

Each token's `tokenUse` claim is checked on verification (`verifyAccessToken`/`verifyRefreshToken` each throw if the claim doesn't match what they expect) **in addition to** using a different signing secret per kind — a leaked access token (short-lived, sent on every request, the more exposed of the two) can never be replayed as a refresh token even if someone tried to forge the claim, because it was never signed with the refresh secret in the first place. `@nestjs/jwt`'s `JwtService` takes a per-call `secret` override, so one service instance handles both kinds rather than needing two separately configured modules.

**What's persisted is never the token itself** — `TokenService.hashToken()` (SHA-256) is what `Session.accessTokenHash`/`refreshTokenHash` store, exactly the same pattern used for OTP/verification-link secrets (`OtpChallenge.codeHash`). A database read alone (backup, replica, compromised read access) cannot be turned into a usable token.

### Refresh rotation & replay protection

Covered in full in `session-management.md` § Refresh Token Rotation — summary: every `/refresh` call issues a new pair and overwrites the session's stored hashes; presenting a hash that doesn't match the session's *current* one is treated as a replay of an already-used token and revokes the entire session, not just the one request. This is this service's primary defense against a stolen refresh token being used silently alongside the legitimate user's continued use — the first sign of reuse kills both.

## Cookies

The refresh token is set as a cookie in addition to being returned in the JSON body (`utils/auth-cookie.util.ts`): `httpOnly` (unreachable from JS, defeating XSS-based token theft), `secure` in production (never sent over plaintext HTTP), `sameSite: strict` (never sent cross-site, defeating CSRF against the refresh endpoint), scoped to `path: /v1/auth` (never sent to routes that don't need it). A browser-based client can rely on the cookie exclusively and never store the refresh token in JS-reachable storage at all.

## Guard pattern — secure by default

`JwtAuthGuard` is registered as a global `APP_GUARD` (`modules/auth/auth.module.ts`) — **every route in the application requires a valid access token by default.** A route opts out explicitly with `@Public()` (`@ecoswift/shared`'s canonical decorator, checked via `Reflector.getAllAndOverride` in the guard). This is the inverse of the more common pattern of guarding routes one at a time: the failure mode of forgetting to add a guard to a new route is "it's protected when it shouldn't need to be" (an easy bug to notice — the route just won't work for an anonymous caller) rather than "it's open when it shouldn't be" (a security bug that's easy to miss in review). `/health`, `/metrics`, and the handful of genuinely anonymous auth routes (`register`, `login`, `refresh`, `forgot-password`, `verify-email`, etc.) are the explicit exceptions.

`JwtStrategy.validate()` doesn't just check the JWT's signature and expiry — it re-reads `Session.status` and `User.status` from the database on **every** authenticated request, so session revocation and account deactivation both take effect immediately rather than only at the token's natural expiry or next refresh. See `session-management.md` § Session revocation for the tradeoff this represents.

## Rate limiting

`RateLimitModule.forRoot({ ttlMs: 60_000, limit: 100, blockDurationMs: 60_000 })` (`@ecoswift/http`, wired in `app.module.ts`) applies a global per-window request cap backed by Redis (`RedisThrottlerStorageModule`) — visible in every response as `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`X-RateLimit-Reset` headers, confirmed live during the Phase 3A smoke test. This is a blunt, service-wide instrument in this phase (not yet a tighter, endpoint-specific limit on `/login` or `/forgot-password` specifically, which is where brute-force/enumeration pressure would actually concentrate) — a documented gap, not a silent one, and a natural candidate for a Phase 3B refinement once real traffic patterns exist to tune against.

Login attempts are separately throttled by the **account lockout policy** (`authentication.md` § Login, `session-management.md` § Account lockout) regardless of IP-based rate limiting — an attacker distributing guesses across many IPs still trips the per-account lockout after `account.max_failed_login_attempts`.

## Enumeration safety

Three endpoints are deliberately enumeration-safe — the response is **identical** whether or not the target account exists, so an attacker cannot use the endpoint to build a list of registered emails:

- `POST /v1/auth/forgot-password` — always `"If that email is registered, a password reset link has been sent."`
- `POST /v1/auth/resend-email-verification` — always the equivalent generic message.
- `POST /v1/auth/login` with a nonexistent email — the identical `401 Invalid email or password` a wrong password on a real account produces, not a distinct "no such user" error.

Session ownership checks use the same principle from the other direction: `DELETE /v1/sessions/:id` for a session id that's real but belongs to someone else returns `403`, not `404` — a `404` would confirm "that id doesn't exist" versus `403`'s "that id exists but isn't yours," letting an attacker enumerate valid session ids by the response code alone.

## Input validation

Every request DTO (`modules/auth/dto/*.ts`) is validated with `class-validator` decorators and the app-wide global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true, transform: true` — `main.ts`): unknown fields are stripped, extra/unexpected fields are rejected outright rather than silently ignored, and payloads are transformed into typed DTO instances before reaching a controller method. Validation failures return a structured `400` with a `violations`-shaped detail list (password policy) or `class-validator`'s per-field messages (everything else) — never a raw stack trace or an ORM error surfaced to the caller.

## Consistent error handling

Every error response — validation failure, `401`, `403`, `409`, unexpected `500` — passes through the shared `HttpExceptionFilter` and comes back in the same envelope: `{ success: false, error: { code, message, details } }`. A caller never has to branch on "is this a NestJS `HttpException` or a raw error" to extract a usable message; the shape is uniform regardless of which layer raised it.

## Structured logging & correlation IDs

`nestjs-pino` (`LoggerModule`) provides structured JSON logging throughout; `CorrelationIdMiddleware`/`RequestIdMiddleware` (`@ecoswift/observability`, wired in `app.module.ts`) attach `x-correlation-id`/`x-request-id` to every request, echoed back in response headers and threaded through every log line for that request — confirmed live in the Phase 3A smoke test (`x-correlation-id`/`x-request-id` headers present on every response). **Passwords, tokens, and OTP secrets are never logged** — request bodies containing them aren't logged verbatim (Pino's `Authorization` header redaction plus the fact that no code path here ever calls `logger.log(dto)` on a DTO that carries a plaintext secret), and every persisted secret is a hash, never the value that could end up in a log by accident.

## Audit logging

Two complementary audit surfaces, deliberately not merged into one:

- **`LoginHistory`** (`session-management.md` § Login history) — an append-only table, queryable directly, answering "when/where has this specific account been accessed."
- **Domain events** (`authentication.md` § Events published) — 13 event types published to `@ecoswift/event-bus`, giving any downstream consumer (audit ingestion, fraud signals, analytics) a durable, replayable stream independent of querying `auth-service`'s own tables directly. This is the same `AuditableEvent` pattern `security-model.md` § Audit strategy describes at the architecture level — this phase is the first place it's actually implemented end to end for a bounded context.

## Observability & resilience

`auth-service` reuses every Phase 2C platform package rather than reimplementing any of it: `@ecoswift/observability` (tracing via `startTracing()`, Prometheus metrics at `/metrics`, the correlation-id middleware above), `@ecoswift/resilience` (circuit breakers/idempotency infrastructure, available to this service the same way it's available to every other), `@ecoswift/cache` and `@ecoswift/queue` (Redis-backed session/rate-limit state and the email/SMS queues respectively). Health is exposed at `/v1/health`, `/v1/health/live`, `/v1/health/ready` (`HealthModule`), checking database and Redis connectivity — all three confirmed live during the Phase 3A smoke test.

---

## What this phase explicitly did not build

Named here so a gap is a documented decision, not a silent one:

- **2FA/TOTP enrollment and verification.** `TwoFactorCredential` exists in the Phase 2B schema and `security-model.md` describes the intended lifecycle; no code in this phase reads or writes it. Risk-based step-up login (`LoginRiskEvaluationService` in the architecture doc) is likewise not implemented — login in this phase is a single-factor password check plus the status/lockout gates above.
- **IP/geo-based risk scoring.** `LOGIN_NEW_DEVICE` alerts trigger on device (User-Agent) recognition only; the email template's `location` field is currently populated with the raw IP address, not a resolved geographic location — real geo-IP resolution is named in `auth.service.ts` as a documented future enhancement, not implemented here.
- **Endpoint-specific rate limiting.** As noted above, rate limiting in this phase is a single global window, not a tighter limit targeted at `/login`, `/forgot-password`, or `/register` specifically.
- **KYC, customer dashboard, transfers, and any other banking operation** — explicitly out of scope per the Phase 3A brief; this service only ever creates a `Customer` at `TIER_0` and stops there.

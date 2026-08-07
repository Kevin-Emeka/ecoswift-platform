# Ecoswift Bank — Enterprise Security Framework

**Phase 3C deliverable.** Cryptography, API security, and account protection — the platform-wide security controls that sit underneath (and around) Identity (`authentication.md`), Authorization (`authorization.md`), and this phase's own MFA/device/session features. Built as a standalone, reusable package — `@ecoswift/security` — for the same reason `@ecoswift/authz` was in Phase 3B: every other service gets the same controls by importing the package, not by re-implementing them.

Companion documents: [`mfa.md`](mfa.md), [`device-security.md`](device-security.md), [`session-security.md`](session-security.md), [`fraud-hooks.md`](fraud-hooks.md).

Security controls are **configurable and environment-aware** throughout — every threshold in this document (encryption keys, CAPTCHA driver, CORS allow-list, body size limit, rate-limit tiers) is read from environment configuration (`packages/config/src/env.schema.ts`) or the database-backed `ConfigurationService` (Phase 2C), never hardcoded, so the same code runs correctly in dev, staging, and production with different postures.

---

## Cryptography

### Encryption Service Abstraction

`EncryptionService` (`@ecoswift/security`) — AES-256-GCM envelope encryption for at-rest sensitive fields. The concrete field this phase encrypts: `TwoFactorCredential.secretEncrypted` (the TOTP seed), a column Phase 2B named for exactly this purpose and left unencrypted until now.

```
envelope = "<8-hex-char-key-id>:<base64 iv>:<base64 auth-tag>:<base64 ciphertext>"
```

GCM is an *authenticated* mode — `decrypt()` throws rather than returning corrupted plaintext if the ciphertext or auth tag was tampered with (`encryption.service.spec.ts` verifies this directly: flipping a byte anywhere in either segment makes decryption fail, never silently succeed with wrong output).

### Key Rotation Strategy

The key id embedded in every ciphertext is `SHA-256(key material)`, truncated to 8 hex characters — computed from the key itself, not a version counter that has to be remembered and incremented. Rotating: generate a new random 32-byte key, set it as `ENCRYPTION_KEY`, move the previous value to `ENCRYPTION_KEY_PREVIOUS`. From that moment, `encrypt()` only ever uses the current key; `decrypt()` tries the current key's id first, falls back to the previous key's id, and throws if a ciphertext matches neither. Data encrypted under the old key keeps decrypting throughout the grace period with no migration step required — verified in `encryption.service.spec.ts`'s key-rotation suite. Only one grace-period key is supported at a time by design: finish re-encrypting existing data under the new key before rotating again.

### Secure Random Generation

`packages/security/src/crypto/secure-random.util.ts` centralizes every random-value generator this platform issues as a credential — `generateSecureToken()` (URL-safe tokens), `generateNumericCode()` (OTP-style codes), `generateRandomBytes()`, and `generateBase32Secret()`/`base32Encode()`/`base32Decode()` (TOTP seeds, RFC 4648) — all built on `node:crypto`, never `Math.random()`. `TotpService`, `BackupCodeService`, `CsrfService`, and `ApiSigningService`'s nonce-adjacent needs all draw from this one place.

### Sensitive Data Encryption Boundaries

Per `security-model.md`'s original boundary ("field-level encryption for the highest-sensitivity fields... so a database-level compromise alone doesn't expose them in plaintext"): `TwoFactorCredential.secretEncrypted` is the boundary this phase actually implements. Passwords remain hashed (Argon2id, one-way, `authentication.md`), never encrypted — encryption is for data that must be *recoverable* (a TOTP seed has to be read back to verify a code); hashing is for data that must never be recoverable at all. Backup codes and OTP codes are hashed (SHA-256), same as passwords, not encrypted — they're single-use secrets compared by hash, never decrypted back to plaintext.

---

## API Security

### Security Headers

`buildHelmetOptions()` (`@ecoswift/security`) — an explicit `helmet()` configuration (`main.ts`'s `app.use(helmet(buildHelmetOptions()))`) rather than the library's bare defaults: a real Content-Security-Policy (`default-src 'self'`, no inline scripts, `object-src 'none'`, `frame-ancestors 'self'`), HSTS with `preload`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and the rest of helmet's standard hardening set — confirmed present on every response during live verification.

### CORS Configuration

`buildCorsOptions()` replaces Phase 3A's `{ origin: true }` (reflect-any-origin) with an explicit allow-list read from `CORS_ALLOWED_ORIGINS` (comma-separated). **Default-deny**: an unset or empty allow-list permits *no* cross-origin browser caller, the opposite failure direction from what `origin: true` defaulted to. A disallowed origin is denied via `callback(null, false)` — not an `Error` — so the request completes as an ordinary response missing `Access-Control-Allow-Origin` (what actually makes the browser block it) rather than a 500; the original implementation threw an `Error` into the callback and was caught, live, surfacing a false alarm 500 for what is a completely ordinary policy rejection, before being fixed (`cors.util.spec.ts` now covers this directly).

### CSRF Protection

Double-submit-cookie, applied specifically where it's actually needed: `CsrfService` issues a non-`httpOnly` `ecoswift_csrf_token` cookie alongside the refresh-token cookie at login; `/v1/auth/refresh` requires a matching `X-CSRF-Token` header **only when the caller is relying on the cookie alone** (no `refreshToken` in the request body) — a body-supplied token (mobile apps, this service's own e2e tests) isn't exploitable via CSRF in the first place, since a forged cross-site request can't know a token it was never given. This is defense-in-depth on top of the primary mitigation, `SameSite=Strict` on both cookies (`authentication.md`).

### Payload Validation

The global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true, transform: true`, `main.ts`) — unchanged from Phase 3A, listed here because it's as much an API-security control as anything new this phase added: unknown fields are stripped, unexpected fields are rejected outright, every DTO validates via `class-validator` before a controller method ever runs.

### Request Size Limits

`applyBodySizeLimits()` replaces Nest's implicit default with an explicit, configured ceiling (`REQUEST_BODY_LIMIT`, default `100kb`) — `main.ts` passes `bodyParser: false` to `NestFactory.create()` so Nest doesn't install its own parser first, then this function installs `express.json()`/`urlencoded()` with the configured limit. An oversized body is rejected with a clean **413**, not a generic 500 — `body-parser`/`raw-body` throw a plain `Error` with `.status = 413` rather than an `HttpException`, which `HttpExceptionFilter` didn't originally recognize (caught live during Phase 3C smoke testing, fixed by teaching the filter to recognize `.status`/`.type: 'entity.too.large'`).

### API Signing Hooks

`ApiSigningService` — HMAC-SHA256 request signature verification (`sign(rawBody, timestamp, secret)` / `verify({ rawBody, timestamp, signature, secret }, toleranceSeconds)`), timestamp *included in* what's signed so a captured signature can't be replayed against a different payload, and a bounded freshness window (default 300s) rejects stale signatures before even computing the HMAC. Not wired into any live endpoint in this phase — no webhook delivery or partner API exists yet — but complete and tested (`api-signing.service.spec.ts`), ready for the first Phase 3D+ feature that needs to prove a request's authenticity.

---

## Account Protection

### Progressive Rate Limiting

`RateLimitModule` (Phase 2C, `@ecoswift/http`) now supports named, layered tiers — `default` (100 requests/min, every route) plus `strict` (30/min, applied via `@Throttle({ strict: {...} })` to `/v1/auth/login`, `/v1/auth/register`, `/v1/auth/forgot-password`). A request is blocked the instant *either* tier's limit is hit. **30/min, not something far stricter, is a deliberate choice**: an earlier draft used 5/min and — caught by running the full e2e suite, not just new tests in isolation — that threshold false-positived on realistic concurrent/rapid legitimate traffic (the test suite's own login volume across many scenarios sharing one source IP), which is exactly the failure mode a real shared-IP source (office NAT, mobile carrier NAT) would also hit in production. The account-level lockout policy below is what protects one specific *account*; this network-level tier's job is only to blunt bulk automated credential-stuffing volume, not to refight that same battle at a different layer.

### Configurable Account Lockout

Unchanged mechanism from `authentication.md`, listed here for completeness: `account.max_failed_login_attempts` (default 5) and `account.lockout_duration_minutes` (default 15), both `ConfigurationService`-backed (database, staff-editable without a deploy) — already "configurable" by Phase 3A's own design, not a new Phase 3C mechanism.

### Password History / Policy Enforcement / Reset Hardening

All pre-existing from Phase 3A (`authentication.md` § Password reset / change / policy) — `PasswordHistory` reuse prevention, `ConfigurationService`-driven complexity rules, forgot-password's enumeration-safe response and full-session-revocation-on-reset. Phase 3C's addition is the *option* to require CAPTCHA verification on the same endpoints (below), layered on top of what already exists rather than replacing it.

### CAPTCHA Integration Abstraction

`CaptchaVerifierPort` + `NoopCaptchaAdapter` (`CAPTCHA_DRIVER=noop`, the default — always succeeds, logs a warning once) + `RecaptchaAdapter` (`CAPTCHA_DRIVER=recaptcha` — real Google reCAPTCHA v3 `siteverify` call, with its own configurable minimum-score threshold, `CAPTCHA_MIN_SCORE`). Endpoints that want CAPTCHA protection depend on `CaptchaVerifierPort`, never a vendor SDK directly — swapping the driver is a config change, not a code change. Not force-wired into registration/login in this phase (doing so would make every dev/test run depend on a live reCAPTCHA key), but complete, tested, and ready to gate any endpoint that adds a `captchaToken` field to its DTO.

---

## Observability

See each companion document's own Observability section for what's specific to it. Platform-wide: every security-relevant fact — MFA challenge outcomes, device registration/revocation, suspicious sessions, role/permission changes (Phase 3B) — writes a structured `SecurityEvent` row (`SecurityEventService`, `prisma/schema.prisma`'s Phase 2B table, dormant until this phase) **and** increments `security_events_total` (a new Prometheus counter, labeled by `event_type`) **and** publishes a typed domain event to `@ecoswift/event-bus` (`packages/event-bus/src/events/security.events.ts`, 9 event types) — the same three-parallel-outputs pattern (durable record, metric, real-time notification) established for authorization actions in `compliance-controls.md`.

## Testing

- **Unit** (`packages/security/src/**/*.spec.ts`, 39 tests): `EncryptionService` (round-trip, tamper detection via auth tag, key rotation grace period), `ApiSigningService` (round-trip, tamper/replay/staleness rejection), `NoopFraudHooksService` (every hook resolves `triggered: false`), `CsrfGuard`, `buildCorsOptions` (allow/deny/default-deny).
- **Unit** (`services/auth-service`, 168 tests total this phase, up from Phase 3B's 130): `TotpService` against the actual RFC 6238 Appendix B published test vectors (not just internal self-consistency), `BackupCodeService`, `MfaService`, `StepUpService`/`StepUpGuard`, `DeviceService` (risk metadata capture, revocation), `SuspiciousSessionDetectorService`, `SecurityEventService`.
- **e2e** (`services/auth-service/test/security-flow.e2e-spec.ts`, real Postgres + Redis): TOTP enrollment → MFA-required login → verification, single-use backup codes, step-up gating a sensitive action, device revocation ending every session on that device, CSRF enforcement on the cookie-only refresh path, and the exact 413-not-500 payload-size behavior — every scenario run manually live first, then captured as a regression test, the same "prove it live, then encode it" pattern every phase of this project has followed.
- **Bugs found by running the full suite, not just new tests**: the CORS `Error`-based rejection (500 → clean deny), the payload-too-large 500 → 413 filter gap, and — the most consequential — the `strict` rate-limit tier's original 5/min threshold breaking legitimate concurrent traffic (including the test suite's own), corrected to 30/min after the full e2e run's cascading failures revealed it.

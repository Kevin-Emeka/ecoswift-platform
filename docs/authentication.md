# Ecoswift Bank — Authentication

**Phase 3A deliverable.** `services/auth-service` — registration, verification, login, logout, token refresh, password lifecycle, phone verification, and account activation/deactivation. Implements the authentication flow `security-model.md` § Step 8 described at the architecture level; this document describes what actually shipped, including where the implementation made a concrete choice the architecture doc left open.

Companion documents: [`session-management.md`](session-management.md) (sessions, devices, concurrent-session policy) and [`security-overview.md`](security-overview.md) (hashing, token design, rate limiting, and everything else security-relevant that isn't a user-facing flow).

Out of scope for this phase, per the Phase 3A brief: KYC, the customer dashboard, transfers, and any other banking operation. 2FA/TOTP enrollment and verification are **not** implemented here either — `TwoFactorCredential` exists in the Phase 2B schema and `security-model.md` describes the intended flow, but no code in this phase reads or writes it; that remains a documented future phase.

---

## Endpoints

All routes are versioned (`/v1/...`) and return the standard error envelope on failure (`packages/shared`'s `HttpExceptionFilter` shape: `{ success: false, error: { code, message, details } }`). Every route requires a bearer access token **except** the ones marked Public — `JwtAuthGuard` is registered as a global `APP_GUARD` (`modules/auth/auth.module.ts`), so authentication is the default and each public route opts out explicitly with `@Public()`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/auth/register` | Public | Create a `PENDING_VERIFICATION` account, send welcome + verification emails |
| POST | `/v1/auth/verify-email` | Public | Consume an email verification link token, activate the account |
| POST | `/v1/auth/resend-email-verification` | Public | Re-issue a verification link (enumeration-safe response) |
| POST | `/v1/auth/login` | Public | Authenticate, issue access/refresh tokens, create a session |
| POST | `/v1/auth/logout` | Bearer | Revoke the current session |
| POST | `/v1/auth/refresh` | Public* | Rotate a refresh token for a new access/refresh pair |
| POST | `/v1/auth/forgot-password` | Public | Request a password reset link (enumeration-safe response) |
| POST | `/v1/auth/reset-password` | Public | Consume a reset token, set a new password, revoke every session |
| POST | `/v1/auth/change-password` | Bearer | Self-service password change (current session survives) |
| POST | `/v1/auth/phone/request-verification` | Bearer | Send a numeric OTP by SMS to the given phone number |
| POST | `/v1/auth/phone/verify` | Bearer | Confirm the OTP, mark the phone verified |
| POST | `/v1/auth/deactivate` | Bearer | Deactivate the caller's own account, revoke every session |
| GET | `/v1/auth/me` | Bearer | Current user profile |
| GET | `/v1/sessions` | Bearer | List the caller's active sessions (see `session-management.md`) |
| DELETE | `/v1/sessions/:id` | Bearer | Revoke one session |
| DELETE | `/v1/sessions` | Bearer | "Sign out everywhere else" |
| GET | `/v1/devices` | Bearer | List devices that have signed in |
| POST | `/v1/devices/:id/trust` | Bearer | Mark a device trusted |
| DELETE | `/v1/devices/:id` | Bearer | Forget a device |

\* `/refresh` doesn't require a bearer *access* token (the whole point is to get a new one), but it does require a valid refresh token in the request body — it's "public" only in the sense that `JwtAuthGuard` doesn't gate it.

Full request/response shapes are in the OpenAPI document served at `/docs` (non-production only, `src/main.ts`) — this document describes flow and behavior, not a field-by-field schema.

---

## Registration → verification

1. `POST /v1/auth/register` validates the payload (`RegisterDto`: email, optional E.164 phone, password, name, date of birth, `countryId` referencing the seeded `Country` catalog), then:
   - Rejects a duplicate email or phone with `409 Conflict` before any password work happens.
   - Runs the password through `PasswordService.validateComplexity()` (Configuration-driven — see `security-overview.md` § Password Policy) and rejects non-compliant passwords with `400 Bad Request` and a structured `violations` list.
   - Hashes the password (Argon2id) and creates `User` (`status: PENDING_VERIFICATION`), `Profile`, and `Customer` (tier `TIER_0`) in one `$transaction`.
   - Records the initial password hash in `PasswordHistory`.
   - Publishes `USER_REGISTERED` and `CUSTOMER_REGISTERED`.
   - Sends the `WELCOME` email, then issues an email-verification link token and sends the `EMAIL_VERIFICATION` email, publishing `EMAIL_VERIFICATION_REQUESTED`.
2. A `PENDING_VERIFICATION` account **cannot log in** — `AuthService.login()` checks status before checking the password and returns `401` with "Please verify your email address before signing in". Verification is a real gate here, not just a notification.
3. `POST /v1/auth/verify-email` takes the link token, resolves it via `OtpService.verifyLinkToken('EMAIL_VERIFICATION', token)` (looks the challenge up by the token's hash directly — the caller isn't authenticated yet, so there's no `userId` to key off), sets `emailVerifiedAt` and `status: ACTIVE`, and publishes `EMAIL_VERIFIED`.
4. `POST /v1/auth/resend-email-verification` always returns the same message regardless of whether the email exists or is already verified — the same enumeration-safety posture as `forgot-password` (see below).

The verification token itself is a 32-byte random value (`OtpService.generateLinkToken`), never persisted in plaintext — only its SHA-256 hash (`OtpChallenge.codeHash`) is stored, matching every other secret-at-rest in this service (see `security-overview.md` § Secrets).

## Login

`POST /v1/auth/login` (`AuthService.login()`):

1. Look up by email. A nonexistent email and a wrong password both return the identical `401 Invalid email or password` — no enumeration signal either way.
2. Auto-unlock: if the account is `LOCKED` and `lockedUntil` has already passed, it's flipped back to `ACTIVE` with the failed-attempt counter reset before evaluating this attempt.
3. Status gates, in order: `LOCKED` (still within the lockout window) → `DEACTIVATED`/`SUSPENDED` → `PENDING_VERIFICATION`. Each has a distinct message; none of them leak whether the password would otherwise have matched.
4. Password verification (Argon2id). A mismatch increments `User.failedLoginAttempts` and — once it reaches `account.max_failed_login_attempts` (default 5) — locks the account for `account.lockout_duration_minutes` (default 15). Every attempt, successful or not, is recorded in `LoginHistory`.
5. On success: `DeviceService.recognize()` fingerprints the device from the User-Agent header, `SessionService.createSession()` creates the session (enforcing the concurrent-session limit — see `session-management.md`), `TokenService.issueTokenPair()` signs the access/refresh pair, and the pair's hashes are written onto the session row.
6. `LOGIN_SUCCEEDED` is published; if the device was unrecognized, a `LOGIN_NEW_DEVICE` email is also sent (`sendNewDeviceAlert`).
7. The response carries `accessToken`, `refreshToken`, `accessTokenExpiresInSeconds`, `userId`, `sessionId`; the refresh token is **also** set as an `httpOnly`/`secure`(prod)/`sameSite=strict` cookie scoped to `/v1/auth` (`utils/auth-cookie.util.ts`), so a browser client can rely on the cookie alone and never touch the refresh token in JS.

`rememberMe: true` extends the refresh token (and the session's `expiresAt`) from `refresh_token.ttl_days` (default 7) to `refresh_token.remember_me_ttl_days` (default 30) — it does not change access-token lifetime or bypass any other check.

## Logout

`POST /v1/auth/logout` revokes the caller's current session (`Session.status: REVOKED`, reason `USER_LOGOUT`) and publishes `LOGOUT_SUCCEEDED`. It's idempotent — logging out twice returns "Already signed out." the second time rather than erroring. Because `JwtStrategy` re-checks `Session.status` on **every** request (not just at token-verify time), the access token stops working immediately on logout even though the JWT itself hasn't expired — see `security-overview.md` § Revocation.

## Refresh — rotation with reuse detection

`POST /v1/auth/refresh` is the one place a request is *not* denied outright by the global guard, because a caller presenting an expiring access token needs a way back in. See `session-management.md` § Refresh Token Rotation for the full mechanics (this is shared ground between the two documents — session state and the token flow are the same thing viewed from two angles). In short: the refresh token's hash must match the session's currently-recorded hash exactly, or the session is revoked outright on the theory that a mismatch means the token was already used once (replay of a stolen token), not a legitimate retry.

## Phone verification

`POST /v1/auth/phone/request-verification` (authenticated) accepts a phone number, updates `User.phone`, generates a 6-digit numeric OTP (`OtpService.generateNumericCode`, purpose `PHONE_VERIFICATION`), and sends it via the `OTP_CHALLENGE` SMS template. `POST /v1/auth/phone/verify` checks the code against the caller's own pending challenge (`OtpService.verifyOwnedCode` — the caller is already authenticated, so this doesn't need the link-token lookup-by-hash approach email verification uses) and sets `phoneVerifiedAt`, publishing `PHONE_VERIFIED`.

Unlike email verification, phone verification is **not** a login gate — an account can be `ACTIVE` and log in with an unverified phone. Only email verification blocks login in this phase.

## Password reset / change / policy

- **Forgot password** (`POST /v1/auth/forgot-password`): always returns `"If that email is registered, a password reset link has been sent."` whether or not the account exists — the same enumeration-safe pattern as resend-verification. If it does exist, a link token is generated (`PASSWORD_RESET` purpose, `password_reset.expiry_minutes` default 30) and emailed via `PASSWORD_RESET_REQUEST`.
- **Reset password** (`POST /v1/auth/reset-password`): resolves the user from the token the same way email verification does, checks the new password against policy *and* history (`PasswordHistory`, default last 5 hashes), then **revokes every active session for the user** (`SessionService.revokeAllForUser`) — a password reset is assumed to follow a compromise, so nothing that was signed in before the reset should stay signed in after it. `PASSWORD_RESET_COMPLETED` and `PASSWORD_CHANGED` are both published; a `PASSWORD_CHANGED` email confirms it out of band.
- **Change password** (`POST /v1/auth/change-password`, authenticated): requires the current password, applies the same policy/history check, and revokes every session **except the one making the request** — the intent is different from a reset (the user is already proven to be who they say they are), so the acting session is allowed to continue.

Password complexity thresholds (`password.min_length`, `require_uppercase`/`lowercase`/`number`/`symbol`) are read from `ConfigurationService` (database-backed, staff-editable — see `packages/config`), falling back to `AUTH_DEFAULTS` (`modules/auth/constants/auth.constants.ts`, min length 12) if unset.

## Account activation / deactivation

Activation is implicit — email verification *is* the activation step (`status: PENDING_VERIFICATION → ACTIVE`). `POST /v1/auth/deactivate` (self-service, authenticated) sets `status: DEACTIVATED` and revokes every session; there is no self-service reactivation in this phase — a deactivated account is a staff/support action to undo, consistent with `security-model.md`'s RBAC matrix reserving account-state changes for staff roles beyond the customer's own deactivate action.

---

## Email templates

Four HTML templates (`prisma/templates/emails/*.html`, seeded via `prisma/seed.ts`'s `seedNotificationTemplates()`), rendered through `AuthNotificationService`'s `{{variable}}` substitution — consistent navy (`#0B1F3A`) / green (`#059669`) branding, table-based layout for email-client compatibility:

| Template code | Sent from | Key variables |
|---|---|---|
| `WELCOME` | `register()` | `firstName`, `portalUrl`, `year` |
| `EMAIL_VERIFICATION` | `register()` (and resend) | `firstName`, `verificationUrl`, `expiryMinutes`, `year` |
| `PASSWORD_RESET_REQUEST` | `forgotPassword()` | `firstName`, `resetUrl`, `expiryMinutes`, `requestIp` (always `"redacted"` — never echo the requester's own IP into an email an attacker requested), `requestedAt`, `year` |
| `LOGIN_NEW_DEVICE` | `sendNewDeviceAlert()` | `firstName`, `loginTime`, `deviceName`, `location`, `ipAddress`, `sessionsUrl`, `year` |

`PASSWORD_CHANGED` (plain-text, pre-existing from Phase 2B seed data) is reused for both the reset and change flows.

## SMS templates

Two templates, plain text (`prisma/seed.ts`):

| Template code | Sent from | Purpose |
|---|---|---|
| `OTP_CHALLENGE` | `requestPhoneVerification()` | 6-digit code + expiry |
| `LOGIN_ALERT_SMS` | (seeded, reserved for a future login-alert-by-SMS path) | Login alert text |

Both dispatch through the Phase 2C notification abstraction: `AuthNotificationService` renders the template, writes `Notification` + `EmailQueue`/`SmsQueue` audit rows, and enqueues onto `@ecoswift/queue`'s `EMAIL_QUEUE`/`SMS_QUEUE`. Actually delivering (an SMTP call, a Twilio call) is deliberately out of scope here — that's `email-service`'s and `sms-service`'s job, consuming these same queues.

---

## Events published

All published via `@ecoswift/event-bus` (`EVENT_PUBLISHER`), landing on Redis Streams under `events:identity.*`. Full payload shapes are in `packages/event-bus/src/events/identity-auth.events.ts`.

| Event | Published from |
|---|---|
| `USER_REGISTERED` | `register()` |
| `EMAIL_VERIFICATION_REQUESTED` | `requestEmailVerification()` |
| `EMAIL_VERIFIED` | `verifyEmail()` |
| `PHONE_VERIFICATION_REQUESTED` | `requestPhoneVerification()` |
| `PHONE_VERIFIED` | `verifyPhone()` |
| `LOGIN_SUCCEEDED` | `login()` |
| `LOGIN_FAILED` | `recordFailedLogin()` (unknown email or wrong password) |
| `LOGOUT_SUCCEEDED` | `logout()` |
| `PASSWORD_CHANGED` | `resetPassword()` and `changePassword()` |
| `PASSWORD_RESET_REQUESTED` | `forgotPassword()` |
| `PASSWORD_RESET_COMPLETED` | `resetPassword()` |
| `SESSION_CREATED` | `SessionService.createSession()` |
| `SESSION_REVOKED` | `SessionService.revoke()` (logout, reuse detection, password reset/change, deactivation, concurrent-limit eviction, self-service revoke) |

---

## Testing

- **Unit** (`src/modules/auth/services/*.spec.ts`, mocked `PrismaService`/dependencies, no real infra): `password.service.spec.ts`, `token.service.spec.ts`, `otp.service.spec.ts`, `session.service.spec.ts`, `auth.service.spec.ts` — 70 tests covering hashing, complexity/reuse policy, token issuance and token-use enforcement, OTP expiry/attempt-limit/reuse, concurrent-session eviction, and every `AuthService` flow branch (lockout, pending-verification gate, refresh rotation and reuse detection, enumeration-safe responses).
- **e2e** (`test/*.e2e-spec.ts`, real Postgres + Redis via `docker compose`, `supertest` against a real `AppModule` graph): `auth-flow.e2e-spec.ts` runs register → block-login-pre-verification → verify → login → protected-route → refresh-rotation → reuse-detection → logout as one continuous sequence against real data; `session-management.e2e-spec.ts` covers concurrent-session eviction and session ownership checks (403, not a leaking 404, on another user's session id) at the HTTP layer.
- Run with `pnpm test` (unit) and `pnpm test:e2e` (e2e, requires `docker compose up -d postgres redis` first).

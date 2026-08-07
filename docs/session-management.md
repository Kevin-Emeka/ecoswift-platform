# Ecoswift Bank — Session Management

**Phase 3A deliverable.** How `services/auth-service` tracks and controls where a customer is signed in: multiple devices, expiration, revocation, concurrent-session limits, remembered ("trusted") devices, and the login/session audit trail. Implements `security-model.md` § Session Lifecycle and § Device Trust; this document describes the concrete mechanics, not just the intent.

See [`authentication.md`](authentication.md) for the surrounding login/logout/refresh flows this all sits inside, and [`security-overview.md`](security-overview.md) for why the token design looks the way it does.

---

## What a `Session` is

A `Session` row (Phase 2B schema) is the unit of "signed in somewhere." It is **not** the same thing as a JWT — a session is a database record that a refresh token happens to reference; the token itself is disposable and rotates constantly, but the session it belongs to persists until it's explicitly revoked or expires. Concretely, `Session` carries:

- `userId`, `deviceId` (optional link to a fingerprinted `Device`)
- `ipAddress`, `userAgent` (from the request that created it, updated on each refresh)
- `accessTokenHash`, `refreshTokenHash` — SHA-256 of the *current* pair, never the tokens themselves (`TokenService.hashToken`)
- `status` (`ACTIVE` / `REVOKED`), `revokedAt`, `revokedReason`
- `issuedAt`, `expiresAt`

`SessionService` (`modules/auth/services/session.service.ts`) is the only thing that reads or writes this table — every other service that needs session state goes through it.

## Multiple devices

Nothing about a session is exclusive — a customer can hold up to the concurrent-session limit (below) active at once, one per device/browser they've logged in from. Each login creates a new `Session` row; nothing is shared or merged across devices. `GET /v1/sessions` lists every active session for the caller, each annotated `isCurrent: true/false` against the session embedded in the caller's own access token, so a client can render "this device" distinctly from "your other sessions."

## Session expiration

Two independent expiry mechanisms:

- **Access token**: `access_token.ttl_minutes` (default 15, `AUTH_DEFAULTS.accessTokenTtlMinutes`). Short-lived by design — a leaked access token is only useful for a few minutes.
- **Refresh token / session**: `refresh_token.ttl_days` (default 7) or, with `rememberMe: true` at login, `refresh_token.remember_me_ttl_days` (default 30). `Session.expiresAt` is computed from this at session-creation time (`AuthService.login()`), *before* the token itself is signed — the session row needs to exist first so `sessionId` can be embedded in the token payload.

There is no separate sliding-inactivity timeout in this phase — a session stays valid for its full fixed lifetime as long as it's never revoked, and is renewed implicitly every time its refresh token rotates (see below). `security-model.md`'s "sliding inactivity timeout **and** absolute maximum" is not yet split into two independent clocks; that refinement is undocumented future work, not something this phase silently dropped.

## Session revocation

Every revocation path funnels through `SessionService.revoke(sessionId, reason)`, which sets `status: REVOKED`, stamps `revokedAt`/`revokedReason`, and publishes `SESSION_REVOKED`. It's idempotent — revoking an already-revoked or nonexistent session is a silent no-op, not an error.

| Reason | Triggered by |
|---|---|
| `USER_LOGOUT` | `POST /v1/auth/logout` |
| `USER_REVOKED` | `DELETE /v1/sessions/:id` (self-service, one session) |
| `USER_REVOKED_ALL_OTHERS` | `DELETE /v1/sessions` ("sign out everywhere else") |
| `REFRESH_TOKEN_REUSE_DETECTED` | A stale (already-rotated) refresh token is presented — see below |
| `ACCOUNT_NOT_ACTIVE` | `/refresh` is called for a session whose user has since gone `DEACTIVATED`/`SUSPENDED` |
| `PASSWORD_RESET` | `POST /v1/auth/reset-password` — every session, no exceptions |
| `PASSWORD_CHANGED` | `POST /v1/auth/change-password` — every session except the one making the request |
| `ACCOUNT_DEACTIVATED` | `POST /v1/auth/deactivate` |
| `CONCURRENT_SESSION_LIMIT_EXCEEDED` | A new login would exceed `session.max_concurrent` |

**Revocation is checked on every request, not just at next token refresh.** `JwtStrategy.validate()` (`modules/auth/strategies/jwt.strategy.ts`) re-reads `Session.status` from the database on every authenticated request — a still-cryptographically-valid, unexpired JWT is rejected the instant its session is revoked. This is a deliberate cost/security tradeoff (a DB read per request instead of trusting the JWT's own claims for the session's liveness) in favor of revocation actually meaning "revoked," immediately.

Self-service revocation (`DELETE /v1/sessions/:id`) checks ownership before revoking: if the session id is real but belongs to a different user, the response is `403 Forbidden`, **not** `404 Not Found` — a 404 would let a caller enumerate valid session ids across other users by probing for which ones 404 vs 403.

## Concurrent session limits

`session.max_concurrent` (Configuration-backed, default 5, `AUTH_DEFAULTS.maxConcurrentSessions`). Enforced in `SessionService.createSession()`, *before* the new session is created: if creating one more would exceed the limit, the least-recently-issued active session(s) are revoked first (reason `CONCURRENT_SESSION_LIMIT_EXCEEDED`) to make room. A new login is never the one silently rejected — an old, likely-forgotten session is always the one that gives way. This was verified against a live 6th login against a limit of 5: the oldest of the 5 existing sessions was evicted and the new login succeeded, leaving exactly 5 active sessions.

## Remembered devices

Device *trust* and session *rememberMe* are two separate, independently-controlled things:

- **`rememberMe`** (login-time flag) only affects how long the resulting refresh token/session lives (7 vs 30 days). It has no bearing on device trust.
- **Device trust** (`DeviceService`, backing `Device.trustLevel`) is a per-device flag a customer sets explicitly via `POST /v1/devices/:id/trust`, independent of any particular login. New devices are always registered `UNTRUSTED` on first sight; nothing about signing in — including `rememberMe` — automatically trusts a device.

Device *recognition* (as opposed to trust) is what happens on every login: `DeviceService.recognize()` fingerprints the request by SHA-256 of the `User-Agent` header alone — **not** IP address, since IPs change constantly (mobile networks, VPNs, ISP reassignment) and folding IP into the fingerprint would make the same physical device look "new" on every network change, defeating device recognition's actual purpose. IP is still recorded per-session and per-login-attempt (`Session.ipAddress`, `LoginHistory.ipAddress`) for audit, just not as part of *what defines the same device*. A first-time fingerprint triggers the `LOGIN_NEW_DEVICE` email alert (`authentication.md` § Email templates); a recognized one does not.

`GET /v1/devices` lists every device that's ever signed in (name/platform parsed from User-Agent via `ua-parser-js`, trust level, last-seen timestamp); `DELETE /v1/devices/:id` forgets a device outright (it will be re-registered, untrusted, on its next login).

## Refresh token rotation

Every `/v1/auth/refresh` call issues a **brand new** access/refresh pair and overwrites `Session.accessTokenHash`/`refreshTokenHash` with the new hashes — the old refresh token's hash no longer matches anything in the session the instant rotation happens, whether or not it's ever presented again. There is no long-lived static refresh token in play at any point in this system, matching `security-model.md`'s stated intent.

### Reuse detection

The presented refresh token's SHA-256 hash must match `Session.refreshTokenHash` **exactly**. A mismatch is not treated as "expired, ask them to log in again" — it's treated as a signal that the token being presented is *stale*: either a legitimate previous rotation already happened (someone is replaying an old, already-consumed token) or the token was never valid in the first place. Either way:

1. The **whole session** is revoked immediately (`REFRESH_TOKEN_REUSE_DETECTED`), not just the one request rejected.
2. Because the session is gone, a token that was validly rotated *moments before* the stale replay — and would otherwise still work — is also invalidated by the same revocation. There is no window where "the newest token still works, only the old one is blocked."
3. The caller must log in again from scratch; there is no automatic recovery path, by design — an unexpected replay is treated as a possible compromise, not a retry-safe edge case.

This was verified end to end (`test/auth-flow.e2e-spec.ts` and, before the automated test existed, a live manual smoke test): rotate once (succeeds, returns pair #2), replay the original token (`401`, session revoked), then attempt to use pair #2's refresh token (also `401`, same revoked session) — confirming the revocation is session-wide, not token-specific.

## Login history / session audit

`LoginHistory` (`LoginHistoryService`) is an **append-only** log of every login attempt, successful or not — never mutated, never deleted by any code path in this service. Each row: `userId` (when known — an attempt against a nonexistent email has no `userId` to attribute it to, only the `LOGIN_FAILED` event captures that case), `sessionId` (successful attempts only), `deviceId`, `ipAddress`, `userAgent`, `successful`, `failureReason`. This is the record that answers "when and from where has this account been accessed" independent of current session state — a session can be long revoked while its `LoginHistory` row remains.

Every session-affecting action also publishes a `SESSION_CREATED`/`SESSION_REVOKED` domain event (`authentication.md` § Events published) onto `@ecoswift/event-bus`, giving any downstream consumer (e.g. a future `audit-service` ingestion pipeline) a durable, replayable record of session lifecycle independent of querying `Session`/`LoginHistory` directly.

## Account lockout (adjacent, session-relevant)

Not a session mechanism itself, but directly gates session creation: `account.max_failed_login_attempts` (default 5) failed attempts within the lockout window locks the account (`status: LOCKED`, `lockedUntil` set `account.lockout_duration_minutes`, default 15, in the future) — no session can be created while locked, regardless of whether the correct password is subsequently presented. The lock auto-clears (`autoUnlockIfExpired`) the next time a login is attempted after `lockedUntil` has passed; there is no background job that proactively unlocks accounts early. See `authentication.md` § Login for the full status-gate ordering.

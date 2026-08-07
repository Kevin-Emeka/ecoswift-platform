# Ecoswift Bank — Multi-Factor Authentication

**Phase 3C deliverable.** TOTP, backup codes, Email OTP, SMS OTP, and step-up authentication — `services/auth-service/src/modules/mfa`. Builds directly on Phase 3A's Identity infrastructure (`OtpService`, `AuthNotificationService`, `TokenService`) and Phase 2B's dormant `TwoFactorCredential`/`BackupCode` tables, rather than introducing a parallel mechanism.

See [`security.md`](security.md) for the cryptography underneath this (`EncryptionService` protecting the TOTP seed) and [`authentication.md`](authentication.md) for the login flow this extends.

---

## Where things live

- **`modules/mfa`** (this phase) — factor enrollment/management (`MfaController`, path `/v1/mfa/...`), login-time challenge/verification (`MfaLoginController`, path `/v1/auth/mfa/...`), and step-up (`StepUpController`, path `/v1/auth/step-up`).
- **`modules/auth`** (Phase 3A, extended this phase) — `AuthService.login()` now checks for enabled MFA factors and, if any exist, returns an `MfaChallengeResponseDto` instead of completing the login; `AuthService.completeLogin()` (extracted from the original `login()` body) is the shared "actually issue a session" logic both the no-MFA path and the MFA-verified path call.

Login-time MFA lives under `/v1/auth/mfa/...`, not `/v1/mfa/...`, deliberately — it's part of the login flow's URL space (same as `/v1/auth/refresh`), even though the controller implementing it is provided by `MfaModule`. Factor *management* (`/v1/mfa/...`) is account-settings surface, a different trust boundary (always requires a full, already-completed login).

## TOTP

`TotpService` — RFC 6238 (built on RFC 4226 HOTP), hand-rolled with `node:crypto`'s HMAC-SHA1 rather than a dependency (the algorithm is a compact, precisely-specified ~40-line construction; a security-sensitive primitive this small is more auditable inline than behind a third-party package). Verified against the **actual published RFC 6238 Appendix B test vectors** (`totp.service.spec.ts`), not just internal self-consistency — the distinction mattered live: an early manual smoke-test script computed a code by hand and got it wrong (a regex bug in the ad hoc reproduction, not the service), which is exactly the class of mistake testing against the standard's own vectors, not a self-written comparison, catches.

- 6-digit codes, 30-second period, ±1 step (±30s) clock-drift tolerance.
- `POST /v1/mfa/totp/enroll` — generates a secret (`generateBase32Secret`, `@ecoswift/security`), encrypts it (`EncryptionService`), stores a **disabled** `TwoFactorCredential`, returns the secret and an `otpauth://` provisioning URI **once** (never retrievable again — an authenticator app's QR scanner reads this URI at enrollment time only).
- `POST /v1/mfa/totp/confirm` — verifies a code from the freshly-scanned authenticator app; on success, enables the credential and issues 10 backup codes.

## Backup Codes

Single-use recovery codes (`BackupCode`, Phase 2B schema), scoped specifically to the **TOTP** factor — they live on `TwoFactorCredential.backupCodes`, and TOTP (an offline authenticator app) is the factor a lost or wiped device can actually strand someone behind; losing access to a verified email or phone is a different recovery problem backup codes don't solve either way, so SMS/EMAIL factors don't get their own set. Format: `XXXX-XXXX` (human-typeable), only the SHA-256 hash ever persisted, shown to the user exactly once — at TOTP confirmation, or on explicit regeneration (`POST /v1/mfa/backup-codes/regenerate`, step-up gated). Consuming a code (`BackupCodeService.consume`) marks it used atomically with the lookup; a second attempt with the same code fails identically to an unknown code — verified live and in `security-flow.e2e-spec.ts` (use once, succeeds; use again, `400`).

## Email OTP / SMS OTP

Not separate infrastructure — `MfaService` reuses `OtpService` (Phase 3A) with the `LOGIN` purpose (seeded in the `OtpPurpose` enum since Phase 3A but never actually used by any flow until this phase) for login-time codes, and `TWO_FACTOR_ENROLLMENT` for enrolling the factor itself. Enrolling SMS requires a verified phone already on the account (`authentication.md`); enrolling EMAIL uses the account's email. Both require a **fresh confirmation code**, sent and verified at enrollment time, before the factor is enabled — proving the user can receive it *right now*, not just that the contact method was verified at some point in the past.

Delivery templates: `OTP_CHALLENGE` (SMS, reused from Phase 3A) and `OTP_CHALLENGE_EMAIL` (new this phase — Phase 3A only had an SMS-shaped OTP template; login/enrollment codes delivered by email needed their own).

## Login Flow

1. `POST /v1/auth/login` with correct credentials. If the account has **no** enabled MFA factor: completes exactly as in Phase 3A, full token pair returned immediately (unchanged, verified by every pre-existing Phase 3A/3B auth test continuing to pass unmodified).
2. If the account **has** an enabled factor: password is still fully verified (a wrong password is rejected before MFA is ever considered — no information about MFA status leaks to a failed credential guess), but no session/tokens are created yet. The response is `{ mfaRequired: true, mfaToken, availableMethods }` instead — `mfaToken` is a short-lived (`mfa.challenge_ttl_minutes`, default 5) JWT (`tokenUse: 'mfa_challenge'`), redeemable only at the two endpoints below.
3. **SMS/EMAIL only**: `POST /v1/auth/mfa/challenge` with `{ mfaToken, method }` sends a fresh code. TOTP and backup codes need no send step.
4. `POST /v1/auth/mfa/verify` with `{ mfaToken, method, code }` — `method` is one of `TOTP | SMS | EMAIL | BACKUP_CODE`. On success, calls the exact same `AuthService.completeLogin()` the no-MFA path uses — device recognition, session creation, token issuance, `LOGIN_SUCCEEDED`, the new-device alert, and (Phase 3C addition) `SuspiciousSessionDetectorService` — are identical regardless of which path got there.

Every verification attempt — success or failure, every method — records a `TWO_FA_CHALLENGE_SUCCEEDED`/`TWO_FA_CHALLENGE_FAILED` `SecurityEvent` and publishes `MFA_CHALLENGE_SUCCEEDED`/`MFA_CHALLENGE_FAILED` (`packages/event-bus`).

## Step-up Authentication

For an **already signed-in** user to unlock a sensitive action (disabling an MFA factor, regenerating backup codes) without a full sign-out/in cycle:

1. `POST /v1/auth/step-up` (authenticated, body `{ method, code }`) re-verifies an MFA factor via the exact same `MfaService.verifyFactor()` the login flow uses, then issues a short-lived (`mfa.step_up_ttl_minutes`, default 10) `stepUpToken` (`tokenUse: 'step_up'`, bound to the specific `userId` **and** `sessionId` that requested it).
2. The follow-up sensitive request presents it as `X-Step-Up-Token`. `StepUpGuard`/`@RequireStepUp()` verifies the token's signature, expiry, and that both `sub` and `sessionId` match the *current* authenticated request — a step-up completed on one device/session never satisfies a sensitive action attempted from another, even for the same user, even within the token's validity window.

Verified live and in `security-flow.e2e-spec.ts`: disabling MFA without a step-up token is `403`; with a valid, matching one, `200`.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/mfa/factors` | Bearer | List enrolled factors (method, enabled, enrolled/disabled timestamps, backup codes remaining for TOTP) |
| POST | `/v1/mfa/totp/enroll` | Bearer | Begin TOTP enrollment |
| POST | `/v1/mfa/totp/confirm` | Bearer | Confirm TOTP, issue backup codes |
| POST | `/v1/mfa/:method/enroll` | Bearer | Begin SMS/EMAIL enrollment (sends a code) |
| POST | `/v1/mfa/:method/confirm` | Bearer | Confirm SMS/EMAIL enrollment |
| DELETE | `/v1/mfa/:method` | Bearer + step-up | Disable a factor |
| POST | `/v1/mfa/backup-codes/regenerate` | Bearer + step-up | Invalidate old codes, issue a new set |
| POST | `/v1/auth/mfa/challenge` | mfaToken | Send an SMS/EMAIL code mid-login |
| POST | `/v1/auth/mfa/verify` | mfaToken | Complete login by verifying a factor |
| POST | `/v1/auth/step-up` | Bearer | Re-verify a factor, obtain a step-up token |

## What this phase did not build

- **Enforcing MFA org-wide** (e.g. "all staff roles above Support must have MFA enabled") — `security-model.md` names this as a Phase 2B/3 policy decision; this phase makes MFA fully functional and optional per-account, not mandatory by role. A future phase could add a `roles:require_mfa`-shaped check at login.
- **TOTP re-sync on sustained clock drift** — the ±1-step tolerance handles ordinary drift; a device whose clock has drifted by minutes has no recovery path here beyond re-enrolling. Real authenticator apps rarely drift this far in practice, but it's a named gap, not a silently absent one.

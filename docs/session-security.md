# Ecoswift Bank — Session Security

**Phase 3C deliverable.** This document covers what's *new* this phase — Suspicious Session Detection and the progressive rate limiting layered onto session-creating endpoints. Session Expiration, Session Revocation, Refresh Token Rotation, and Concurrent Session Limits were all built in Phase 3A and are documented in full in [`session-management.md`](session-management.md) — not repeated here, to avoid the two documents drifting apart. Read that document first if you haven't; this one assumes it.

---

## Suspicious Session Detection

**A real, working heuristic** — not an extension-point stub like [`fraud-hooks.md`](fraud-hooks.md)'s hooks. `SuspiciousSessionDetectorService` (`modules/security`) runs on every successful login (`AuthService.completeLogin()`, right after the new session is created) and checks: does this user already hold another **active** session from a **different IP address**, created within `session.suspicious_ip_change_window_minutes` (`ConfigurationService`-backed, default 5 minutes) of this one?

If so, it **records and notifies — it never blocks anything**:

- A `SUSPICIOUS_SESSION` `SecurityEvent`, with both sessions' ids and IPs in `metadata`.
- A `SUSPICIOUS_SESSION_DETECTED` domain event (`packages/event-bus`).

That's the entire action taken. Two logins from different networks within a few minutes of each other is either an ordinary multi-device moment (a laptop and a phone both signing in around the same time) or a credential-sharing/compromise signal — this heuristic can't distinguish which, so it deliberately doesn't try to decide; it surfaces the fact for a human or a future, better-informed system to act on.

### Why this is "detection" and the Fraud Detection Hooks are "hooks"

The Phase 3C brief separates these two ideas, and the distinction is real, not just naming: `SuspiciousSessionDetectorService` is a complete, working feature under **Session Security** (a section the brief asks to be *implemented*) — it runs a genuine heuristic against real session data and produces a genuine, meaningful signal. The **Fraud Detection Hooks** (`fraud-hooks.md`) are explicitly scoped to *extension points only* ("do not implement fraud decisioning yet") — every one of those seven hooks always returns `triggered: false` today. This service's "impossible travel"-adjacent heuristic (different IP, short window) is deliberately **not** built as one of the fraud hooks' `evaluateImpossibleTravel()` — that hook stays a pure no-op per the brief's explicit instruction, while this session-security feature does real, bounded work within a much narrower, well-understood claim ("two sessions, two IPs, one short window") that doesn't require real geo-IP resolution or scoring to be useful.

### What it does not do

- **No real geo-IP resolution.** "Different IP" is the entire signal — not "different country" or "implausible distance in implausible time," which would need a geo-IP database this platform doesn't have (the same documented gap `authentication.md`'s `LOGIN_NEW_DEVICE` alert already names for its own `location` field).
- **No blocking, no step-up trigger, no session termination.** A flagged session continues exactly as any other session would. Elevating this into an actual response (forcing step-up, notifying the user by email, holding the session for review) is a natural next step for a phase that's allowed to make decisions, not just detect.

## Progressive Rate Limiting on Session-Creating Endpoints

`/v1/auth/login`, `/v1/auth/refresh`'s siblings, and account-creation/reset endpoints sit behind the `strict` throttle tier described in full in [`security.md`](security.md) § Progressive Rate Limiting (30 requests/minute per IP, layered on top of the 100/minute global default). Named here because session creation is exactly what this tier exists to protect — a brute-force or credential-stuffing campaign is, mechanically, an attempt to create many sessions very fast from one source.

## Observability

Every suspicious-session detection and every session lifecycle event (creation, revocation — Phase 3A) that already published a domain event continues to; this phase adds `SUSPICIOUS_SESSION_DETECTED` to that set and ensures the `SecurityEvent` write, the `security_events_total` metric increment, and the domain event publish all happen together (`SecurityEventService`, `security.md` § Observability) rather than each call site remembering all three separately.

## Testing

`suspicious-session-detector.service.spec.ts` (unit, mocked Prisma): no-op when there's no qualifying other session; flags correctly when one exists, with the right metadata; correctly scopes the comparison query to exclude the new session itself and same-IP sessions; reads the configurable window rather than a hardcoded value; never throws (detection, not enforcement, even when it does flag something). Exercised indirectly in every e2e login flow (`auth-flow.e2e-spec.ts`, `security-flow.e2e-spec.ts`) since it runs on every `completeLogin()` call — none of those flows fail or change behavior because of it, confirming it's genuinely non-blocking in practice, not just by code inspection.

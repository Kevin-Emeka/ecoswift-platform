# Ecoswift Bank — Device Security

**Phase 3C deliverable.** Trusted devices, fingerprinting, registration, revocation, and risk metadata — extending Phase 3A's `DeviceService` rather than introducing a parallel mechanism, since Identity's existing device recognition is exactly what device security builds on.

See [`session-management.md`](session-management.md) § Remembered devices for the Phase 3A foundation this phase extends (recognition, trust, device-vs-session distinction), and [`fraud-hooks.md`](fraud-hooks.md) for the new-device fraud signal this phase wires in.

---

## Device Fingerprinting (unchanged from Phase 3A)

SHA-256 of the `User-Agent` header alone — deliberately **not** IP, since IPs change constantly (mobile networks, VPNs) and folding IP into the fingerprint would make the same physical device look "new" on every network change. This design decision predates Phase 3C and is not revisited here; see `session-management.md` for the full reasoning.

## Device Registration

Unchanged trigger (every login recognizes/registers a device, `DeviceService.recognize()`), but Phase 3C adds two things to what happens when a device is genuinely new:

1. **Fraud Detection Hooks** — `FraudHooksPort.evaluateNewDevice()` (`@ecoswift/security`) is called with the registration context (`userId`, `ipAddress`, `userAgent`, the new `deviceId`). The default `NoopFraudHooksService` always returns `{ triggered: false, score: 0 }` (see `fraud-hooks.md` — this phase builds the extension point, not the decisioning), but the *call* is real and live at the moment a new-device signal actually exists, not a stub sitting unused.
2. **Structured observability** — a `DEVICE_REGISTERED` `SecurityEvent` is recorded and a `DEVICE_REGISTERED` domain event published (`packages/event-bus`), in addition to the existing new-device email alert (`authentication.md`).

## Device Risk Metadata

New `Device` columns this phase adds (additive migration, `prisma/schema.prisma`):

| Column | Populated by | Purpose |
|---|---|---|
| `lastIpAddress` | Every `recognize()` call, new or existing device | The most recent network origin seen for this device — audit/risk context, never part of the fingerprint itself |
| `riskScore` | The fraud hook's output at registration time | `0–1`; always `0` under the default no-op hook, ready for a real scoring implementation to populate meaningfully |
| `riskMetadata` | The fraud hook's output | Free-form JSON the hook implementation controls the shape of |
| `revokedAt` / `revokedReason` | `DeviceService.revoke()` | When/why a device was revoked (see below) — kept, not deleted, so the record and its risk history survive for review |

`GET /v1/devices` returns all of this (`DeviceResponseDto`), verified live: a freshly-registered device shows `lastIpAddress: "::1"` (local smoke test) and `riskScore: 0` (the no-op hook's honest answer).

## Device Revocation

**New this phase**, distinct from Phase 3A's `remove()`:

- **`remove()`** (unchanged, `DELETE /v1/devices/:id`) — self-service "forget this device," a soft, low-stakes cleanup action. Hard-deletes the `Device` row. Does not itself end any session.
- **`revoke()`** (new, `POST /v1/devices/:id/revoke`) — the security-triggered action: "I think this device is compromised." Marks the device revoked (`revokedAt`/`revokedReason` set, `trustLevel` reset to `UNTRUSTED`) **and immediately ends every active session tied to it**, iterating `SessionService.revoke()` for each. The device row is kept, not deleted — its risk history and the fact that it was revoked (and why) remain reviewable.

Verified live: a user with 5 active sessions all sharing one device (the smoke-test client's fingerprint) called `revoke()` once; all 5 sessions transitioned to `REVOKED` with `revokedReason` prefixed `DEVICE_REVOKED:`, and the access token from any of them immediately failed with `401 Session is no longer active` on the very next request — no propagation delay, no need to wait for token expiry.

## Trusted Devices

Unchanged from Phase 3A: `trustLevel` (`UNTRUSTED`/`TRUSTED`), set via `POST /v1/devices/:id/trust`. New this phase: trusting a device now also records a `DEVICE_TRUSTED` `SecurityEvent` (previously only the `SecurityEvent` *enum value* existed, unused — this phase is the first to actually write it).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/devices` | List devices, including risk metadata |
| POST | `/v1/devices/:id/trust` | Mark a device trusted |
| DELETE | `/v1/devices/:id` | Forget a device (self-service, no session impact) |
| POST | `/v1/devices/:id/revoke` | Revoke a device — ends every active session on it |

## Testing

`device.service.spec.ts` (unit, mocked Prisma/dependencies): recognition updates `lastIpAddress` without calling the fraud hook for a known device; a genuinely new device calls the hook, persists its score/metadata, and records/publishes `DEVICE_REGISTERED`; `revoke()` is a no-op for a device that isn't the caller's, and correctly scopes session revocation to *only* sessions on that specific device. `security-flow.e2e-spec.ts` (e2e, real Postgres/Redis) covers the full revoke-ends-every-session flow against a live session.

## What this phase did not build

- **Real risk scoring** — `riskScore`/`riskMetadata` are populated but always `{0, {}}`-shaped under the default hook; a real implementation (device reputation, jailbreak/root detection from a mobile SDK, IP reputation) is Phase 3D+ scope, matching `fraud-hooks.md`'s "extension points, not decisioning" boundary.
- **Client-supplied device attestation** (e.g. a mobile app submitting a hardware-backed device identifier) — fingerprinting remains server-derived from the User-Agent header only, unchanged from Phase 3A.

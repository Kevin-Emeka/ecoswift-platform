# Ecoswift Bank — Fraud Detection Hooks

**Phase 3C deliverable.** Extension points for future fraud decisioning — `FraudHooksPort` (`@ecoswift/security`). Per the Phase 3C brief, explicit and unambiguous: **"Create extension points for [...]. Do not implement fraud decisioning yet."** This document describes what was built to that exact specification: real, typed, already-wired-into-live-request-flow hooks whose *judgment* is deliberately absent.

See [`session-security.md`](session-security.md) for why "impossible travel" ended up implemented as a real Suspicious Session Detection *feature* rather than through this hook — the two are related but answer different questions, and that document explains the boundary between them directly.

---

## The seven signal types

```ts
export interface FraudHooksPort {
  evaluateImpossibleTravel(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateVelocity(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateNewDevice(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateHighRiskLogin(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateHighRiskTransaction(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateGeoAnomaly(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateBehavioralRisk(context: FraudSignalContext): Promise<FraudSignal>;
}
```

Every one of these — named exactly per the brief's list — is a real TypeScript interface method, not a comment or a TODO. `FraudSignalContext` is a shared, superset shape (`userId`, `ipAddress`, `userAgent`, `deviceId`, `isNewDevice`, `sessionId`, and transaction-shaped fields for the two transaction-adjacent hooks); `FraudSignal` is the shared return shape: `{ signalType, triggered, score, reason?, metadata? }`.

## The default implementation

`NoopFraudHooksService` — the only implementation registered in this phase (`SecurityModule`'s `{ provide: FRAUD_HOOKS, useClass: NoopFraudHooksService }`). Every method resolves the same shape regardless of input:

```ts
{ signalType: '<the specific type>', triggered: false, score: 0, reason: 'fraud decisioning not implemented — extension point only' }
```

This is the literal, concrete meaning of "do not implement fraud decisioning yet": the *hook* is real and callable; the *answer* is always "nothing to see here," honestly labeled as such in the `reason` field rather than a bare `false` that could be mistaken for a real "checked, and it's fine" verdict.

## Where hooks are actually called today

Only one is wired into a live call site in this phase — deliberately narrow, matching the brief's framing that these are extension points *for future* decisioning, not a checklist to bolt onto every endpoint regardless of whether there's a real caller yet:

- **`evaluateNewDevice()`** — `DeviceService.recognize()` (`device-security.md`), the moment a genuinely new device is registered. The result's `score`/`metadata` are persisted onto the new `Device.riskScore`/`riskMetadata` columns even though the no-op always returns `0`/`undefined` — so a future real implementation's history isn't empty starting from day one; the plumbing (call site → persisted result → visible in `GET /v1/devices`) was proven correct against the no-op before any real logic exists to plug in.

The other six (`evaluateImpossibleTravel`, `evaluateVelocity`, `evaluateHighRiskLogin`, `evaluateHighRiskTransaction`, `evaluateGeoAnomaly`, `evaluateBehavioralRisk`) are complete, typed, unit-tested (`noop-fraud-hooks.service.spec.ts` — all seven, not just the one wired up) interface methods with no live call site yet. `evaluateHighRiskTransaction` in particular has no caller because no transaction feature exists in this phase at all (explicitly out of scope, per the stop condition) — its shape is ready for whichever future phase implements transactions to call it at the right moment, without needing to touch this interface.

## How a future phase plugs in a real implementation

Nothing about the call sites changes. A real fraud-scoring service (a rule engine, an ML model, a third-party fraud API) implements `FraudHooksPort` and is registered in place of `NoopFraudHooksService`:

```ts
{ provide: FRAUD_HOOKS, useClass: RealFraudScoringService }
```

Every existing caller (today: `DeviceService.recognize()`; tomorrow: wherever `evaluateHighRiskLogin`/`evaluateVelocity`/etc. get wired in) starts receiving real `triggered`/`score` values immediately, with no changes needed at the call site — the interface boundary is exactly where Phase 3C's work stops and a future phase's begins. What that future phase adds beyond a new implementation: actually branching on `triggered`/`score` at each call site (holding a login, requiring step-up, flagging a transaction for review) — the *decisioning* this phase was explicitly told not to build.

## Testing

`noop-fraud-hooks.service.spec.ts` — every one of the seven methods, individually, asserted to resolve `triggered: false, score: 0` for the correct `signalType`, regardless of input shape. `device.service.spec.ts` and `security-flow.e2e-spec.ts` cover the one live call site (`evaluateNewDevice`) end to end, including that its output is correctly persisted onto the `Device` row.

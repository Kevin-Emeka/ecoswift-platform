export const FRAUD_HOOKS = Symbol('FRAUD_HOOKS');

/** Shared context every fraud hook receives — a superset; individual hooks read only the fields relevant to them. */
export interface FraudSignalContext {
  userId: string;
  ipAddress: string;
  userAgent?: string;
  deviceId?: string;
  isNewDevice?: boolean;
  sessionId?: string;
  /** Present only for the transaction-shaped hooks. */
  transactionAmount?: number;
  transactionCurrency?: string;
  metadata?: Record<string, unknown>;
}

export interface FraudSignal {
  signalType:
    | 'IMPOSSIBLE_TRAVEL'
    | 'VELOCITY'
    | 'NEW_DEVICE'
    | 'HIGH_RISK_LOGIN'
    | 'HIGH_RISK_TRANSACTION'
    | 'GEO_ANOMALY'
    | 'BEHAVIORAL_RISK';
  /** Whether this hook's heuristic fired. Every default implementation in this package always returns `false` — see the module doc comment. */
  triggered: boolean;
  /** 0–1, only meaningful when `triggered` is true. */
  score: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fraud Detection Hooks (Phase 3C brief — "Create extension points... Do
 * not implement fraud decisioning yet"). Every method here is a named,
 * typed, already-wired-into-the-real-request-flow **extension point** —
 * `AuthService`/`SessionService`/future transaction-processing code call
 * these at the moments a fraud signal would actually need to be evaluated
 * (login, session creation, ...) — but the *default* implementation
 * (`NoopFraudHooksService`) always returns `triggered: false` for every
 * signal. Nothing in this codebase currently branches on `triggered` to
 * deny or hold anything; a future phase supplies a real implementation
 * (rule engine, ML scoring service, third-party fraud API) behind this
 * exact same interface, and every call site that already invokes these
 * hooks starts actually enforcing something without being touched again.
 */
export interface FraudHooksPort {
  evaluateImpossibleTravel(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateVelocity(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateNewDevice(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateHighRiskLogin(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateHighRiskTransaction(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateGeoAnomaly(context: FraudSignalContext): Promise<FraudSignal>;
  evaluateBehavioralRisk(context: FraudSignalContext): Promise<FraudSignal>;
}

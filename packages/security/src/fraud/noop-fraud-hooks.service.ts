import { Injectable } from '@nestjs/common';
import type { FraudHooksPort, FraudSignal, FraudSignalContext } from './fraud-hooks.port';

/**
 * The default `FraudHooksPort` implementation — every signal type always
 * resolves `triggered: false, score: 0`. This is the concrete
 * implementation of "do not implement fraud decisioning yet": the hook is
 * real, callable, and wired into real flows; the *judgment* is not.
 */
@Injectable()
export class NoopFraudHooksService implements FraudHooksPort {
  async evaluateImpossibleTravel(context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('IMPOSSIBLE_TRAVEL', context);
  }

  async evaluateVelocity(context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('VELOCITY', context);
  }

  async evaluateNewDevice(context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('NEW_DEVICE', context);
  }

  async evaluateHighRiskLogin(context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('HIGH_RISK_LOGIN', context);
  }

  async evaluateHighRiskTransaction(context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('HIGH_RISK_TRANSACTION', context);
  }

  async evaluateGeoAnomaly(context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('GEO_ANOMALY', context);
  }

  async evaluateBehavioralRisk(context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('BEHAVIORAL_RISK', context);
  }

  private notTriggered(signalType: FraudSignal['signalType'], _context: FraudSignalContext): FraudSignal {
    return { signalType, triggered: false, score: 0, reason: 'fraud decisioning not implemented — extension point only' };
  }
}

import { NoopFraudHooksService } from './noop-fraud-hooks.service';
import type { FraudSignalContext } from './fraud-hooks.port';

describe('NoopFraudHooksService', () => {
  const service = new NoopFraudHooksService();
  const context: FraudSignalContext = { userId: 'user-1', ipAddress: '127.0.0.1' };

  it.each([
    ['evaluateImpossibleTravel', 'IMPOSSIBLE_TRAVEL'],
    ['evaluateVelocity', 'VELOCITY'],
    ['evaluateNewDevice', 'NEW_DEVICE'],
    ['evaluateHighRiskLogin', 'HIGH_RISK_LOGIN'],
    ['evaluateHighRiskTransaction', 'HIGH_RISK_TRANSACTION'],
    ['evaluateGeoAnomaly', 'GEO_ANOMALY'],
    ['evaluateBehavioralRisk', 'BEHAVIORAL_RISK'],
  ] as const)('%s always resolves triggered:false with a zero score', async (method, signalType) => {
    const result = await service[method](context);
    expect(result).toEqual(
      expect.objectContaining({ signalType, triggered: false, score: 0 }),
    );
  });

  it('every hook resolves rather than rejecting, regardless of context shape', async () => {
    const minimalContext: FraudSignalContext = { userId: 'u', ipAddress: '::1' };
    await expect(service.evaluateHighRiskTransaction(minimalContext)).resolves.toBeDefined();
  });
});

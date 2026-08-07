import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import type { FraudHooksPort, FraudSignal, FraudSignalContext } from '@ecoswift/security';
import { resolveHighValueTransferThreshold } from './transfer-thresholds';

const VELOCITY_WINDOW_MINUTES = 10;
const VELOCITY_TRIGGER_COUNT = 3;
const NEW_DEVICE_WINDOW_HOURS = 24;

/**
 * The first real `FraudHooksPort` implementation in this codebase — every
 * prior caller of this port (`DeviceService` in auth-service) has only
 * ever seen `NoopFraudHooksService`. Scoped specifically to money
 * movement: `evaluateVelocity`/`evaluateNewDevice`/`evaluateHighRiskTransaction`
 * have real heuristics here; the other four signal types
 * (impossible-travel, geo-anomaly, high-risk-login, behavioral-risk) need
 * login-time context this service never receives, so they stay honest
 * no-ops — same shape as `NoopFraudHooksService`, not silently different
 * behavior.
 *
 * Provided as `FRAUD_HOOKS` only within `account-service`'s own DI graph
 * (see `TransfersModule`) — auth-service keeps using the package's
 * `NoopFraudHooksService` default for its own login/device-registration
 * call sites, which this phase doesn't touch.
 */
@Injectable()
export class TransferFraudHooksService implements FraudHooksPort {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateVelocity(context: FraudSignalContext): Promise<FraudSignal> {
    const customer = await this.prisma.customer.findUnique({ where: { userId: context.userId }, select: { id: true } });
    if (!customer) return this.notTriggered('VELOCITY');

    const accountIds = (await this.prisma.account.findMany({ where: { customerId: customer.id }, select: { id: true } })).map(
      (a) => a.id,
    );
    if (accountIds.length === 0) return this.notTriggered('VELOCITY');

    const since = new Date(Date.now() - VELOCITY_WINDOW_MINUTES * 60 * 1000);
    const count = await this.prisma.transaction.count({
      where: {
        sourceAccountId: { in: accountIds },
        status: 'COMPLETED',
        createdAt: { gte: since },
        transactionType: { code: { in: ['TRANSFER_INTERNAL', 'TRANSFER_EXTERNAL'] } },
      },
    });

    if (count < VELOCITY_TRIGGER_COUNT) return this.notTriggered('VELOCITY');
    return {
      signalType: 'VELOCITY',
      triggered: true,
      score: Math.min(1, count / (VELOCITY_TRIGGER_COUNT * 2)),
      reason: `${count} outbound transfers in the last ${VELOCITY_WINDOW_MINUTES} minutes`,
      metadata: { count, windowMinutes: VELOCITY_WINDOW_MINUTES },
    };
  }

  async evaluateNewDevice(context: FraudSignalContext): Promise<FraudSignal> {
    if (!context.deviceId) {
      // No device on the session at all (shouldn't normally happen for an
      // authenticated transfer request) — treat as maximally unknown.
      return { signalType: 'NEW_DEVICE', triggered: true, score: 0.6, reason: 'No device associated with this session' };
    }

    const device = await this.prisma.device.findUnique({ where: { id: context.deviceId } });
    if (!device) return { signalType: 'NEW_DEVICE', triggered: true, score: 0.6, reason: 'Unrecognized device' };

    if (device.trustLevel === 'UNTRUSTED') {
      return { signalType: 'NEW_DEVICE', triggered: true, score: 0.7, reason: 'Device has not been trusted', metadata: { deviceId: device.id } };
    }

    const ageMs = Date.now() - device.createdAt.getTime();
    if (ageMs < NEW_DEVICE_WINDOW_HOURS * 60 * 60 * 1000) {
      return {
        signalType: 'NEW_DEVICE',
        triggered: true,
        score: 0.4,
        reason: `Device first seen ${Math.round(ageMs / (60 * 60 * 1000))}h ago`,
        metadata: { deviceId: device.id },
      };
    }

    return this.notTriggered('NEW_DEVICE');
  }

  async evaluateHighRiskTransaction(context: FraudSignalContext): Promise<FraudSignal> {
    if (context.transactionAmount === undefined) return this.notTriggered('HIGH_RISK_TRANSACTION');

    const threshold = await resolveHighValueTransferThreshold(this.prisma);
    if (context.transactionAmount < threshold) return this.notTriggered('HIGH_RISK_TRANSACTION');

    return {
      signalType: 'HIGH_RISK_TRANSACTION',
      triggered: true,
      score: Math.min(1, context.transactionAmount / (threshold * 2)),
      reason: `Amount ${context.transactionAmount} meets or exceeds the high-value threshold of ${threshold}`,
      metadata: { threshold },
    };
  }

  // Not applicable to a transfer-scoped fraud hook — see class doc comment.
  async evaluateImpossibleTravel(_context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('IMPOSSIBLE_TRAVEL');
  }
  async evaluateHighRiskLogin(_context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('HIGH_RISK_LOGIN');
  }
  async evaluateGeoAnomaly(_context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('GEO_ANOMALY');
  }
  async evaluateBehavioralRisk(_context: FraudSignalContext): Promise<FraudSignal> {
    return this.notTriggered('BEHAVIORAL_RISK');
  }

  private notTriggered(signalType: FraudSignal['signalType']): FraudSignal {
    return { signalType, triggered: false, score: 0 };
  }
}

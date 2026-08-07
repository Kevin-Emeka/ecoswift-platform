import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import { EncryptionService, FRAUD_HOOKS, TotpService } from '@ecoswift/security';
import type { FraudHooksPort, FraudSignal } from '@ecoswift/security';

export interface RiskAssessment {
  requiresStepUp: boolean;
  signals: FraudSignal[];
}

/**
 * Sits between `InternalTransferService`/`ExternalTransferService` and
 * `FRAUD_HOOKS` — runs the three transfer-relevant signals
 * (`TransferFraudHooksService`), decides whether the attempt needs MFA
 * step-up, and (separately) verifies a step-up code against the caller's
 * enrolled TOTP factor. Any signal triggering is enough to require
 * step-up — this phase doesn't try to weigh/combine scores into a single
 * number, since with only three real heuristics a simple OR is honest
 * about how little signal there actually is to combine.
 */
@Injectable()
export class TransferRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly totpService: TotpService,
    @Inject(FRAUD_HOOKS) private readonly fraudHooks: FraudHooksPort,
  ) {}

  async assess(params: { userId: string; deviceId?: string; amount: number; currencyCode: string }): Promise<RiskAssessment> {
    const context = {
      userId: params.userId,
      ipAddress: 'n/a', // Not available at this layer (see FraudSignalContext) — velocity/new-device/high-risk-transaction don't read it.
      deviceId: params.deviceId,
      transactionAmount: params.amount,
      transactionCurrency: params.currencyCode,
    };

    const [velocity, newDevice, highRisk] = await Promise.all([
      this.fraudHooks.evaluateVelocity(context),
      this.fraudHooks.evaluateNewDevice(context),
      this.fraudHooks.evaluateHighRiskTransaction(context),
    ]);

    const signals = [velocity, newDevice, highRisk].filter((s) => s.triggered);
    return { requiresStepUp: signals.length > 0, signals };
  }

  async hasTotpEnrolled(userId: string): Promise<boolean> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method: 'TOTP' } } });
    return !!credential?.isEnabled;
  }

  async verifyStepUpCode(userId: string, code: string): Promise<boolean> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId_method: { userId, method: 'TOTP' } } });
    if (!credential?.isEnabled || !credential.secretEncrypted) return false;
    return this.totpService.verify(this.encryptionService.decrypt(credential.secretEncrypted), code);
  }
}

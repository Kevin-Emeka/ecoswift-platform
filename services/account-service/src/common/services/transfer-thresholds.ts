import type { PrismaService } from '@ecoswift/database';

export const DEFAULT_HIGH_VALUE_TRANSFER_THRESHOLD = 5000;

/**
 * Single source of truth for "large/high-value transfer" — the same number
 * that makes `TransferFraudHooksService.evaluateHighRiskTransaction` demand
 * MFA step-up also decides when the large-transfer-alert email fires, so a
 * customer is never alerted about an amount that didn't also require them
 * to step up (or vice versa). Admin-configurable via
 * `ApplicationSetting['transfer.maker_checker_threshold']`.
 */
export async function resolveHighValueTransferThreshold(prisma: PrismaService): Promise<number> {
  const setting = await prisma.applicationSetting.findUnique({ where: { key: 'transfer.maker_checker_threshold' } });
  const parsed = setting ? Number(setting.value) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_HIGH_VALUE_TRANSFER_THRESHOLD;
}

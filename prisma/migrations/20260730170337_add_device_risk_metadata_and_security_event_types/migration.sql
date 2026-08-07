-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SecurityEventType" ADD VALUE 'TWO_FA_CHALLENGE_SUCCEEDED';
ALTER TYPE "SecurityEventType" ADD VALUE 'TWO_FA_CHALLENGE_FAILED';
ALTER TYPE "SecurityEventType" ADD VALUE 'BACKUP_CODE_USED';
ALTER TYPE "SecurityEventType" ADD VALUE 'BACKUP_CODES_REGENERATED';
ALTER TYPE "SecurityEventType" ADD VALUE 'STEP_UP_COMPLETED';
ALTER TYPE "SecurityEventType" ADD VALUE 'STEP_UP_FAILED';
ALTER TYPE "SecurityEventType" ADD VALUE 'DEVICE_REGISTERED';
ALTER TYPE "SecurityEventType" ADD VALUE 'DEVICE_REVOKED';
ALTER TYPE "SecurityEventType" ADD VALUE 'SUSPICIOUS_SESSION';
ALTER TYPE "SecurityEventType" ADD VALUE 'FRAUD_SIGNAL_DETECTED';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "last_ip_address" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMPTZ(6),
ADD COLUMN     "revoked_reason" TEXT,
ADD COLUMN     "risk_metadata" JSONB,
ADD COLUMN     "risk_score" DECIMAL(5,2);

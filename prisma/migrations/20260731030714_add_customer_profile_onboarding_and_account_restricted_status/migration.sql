-- CreateEnum
CREATE TYPE "ProfileCompletionStatus" AS ENUM ('INCOMPLETE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_AND_CONDITIONS', 'PRIVACY_POLICY', 'MARKETING_COMMUNICATIONS');

-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'RESTRICTED';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "address_country_code" CHAR(2),
ADD COLUMN     "address_line1" TEXT,
ADD COLUMN     "address_line2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "preferred_currency_id" UUID,
ADD COLUMN     "preferred_language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "profile_completion_status" "ProfileCompletionStatus" NOT NULL DEFAULT 'INCOMPLETE',
ADD COLUMN     "state" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_consents_customer_id_consent_type_created_at_idx" ON "customer_consents"("customer_id", "consent_type", "created_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_preferred_currency_id_fkey" FOREIGN KEY ("preferred_currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

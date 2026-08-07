-- AlterTable
ALTER TABLE "beneficiaries" ADD COLUMN     "bank_address" TEXT,
ADD COLUMN     "bank_country_code" CHAR(2),
ADD COLUMN     "routing_number" TEXT,
ADD COLUMN     "swift_bic" TEXT;

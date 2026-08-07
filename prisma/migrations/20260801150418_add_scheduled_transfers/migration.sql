-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ScheduledTransferStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "scheduled_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "source_account_id" UUID NOT NULL,
    "transfer_channel" "TransferChannel" NOT NULL,
    "destination_account_id" UUID,
    "destination_beneficiary_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_id" UUID NOT NULL,
    "description" TEXT,
    "frequency" "ScheduleFrequency" NOT NULL,
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6),
    "status" "ScheduledTransferStatus" NOT NULL DEFAULT 'SCHEDULED',
    "last_run_at" TIMESTAMPTZ(6),
    "last_transaction_id" UUID,
    "failure_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scheduled_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_transfers_customer_id_idx" ON "scheduled_transfers"("customer_id");

-- CreateIndex
CREATE INDEX "scheduled_transfers_status_next_run_at_idx" ON "scheduled_transfers"("status", "next_run_at");

-- AddForeignKey
ALTER TABLE "scheduled_transfers" ADD CONSTRAINT "scheduled_transfers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_transfers" ADD CONSTRAINT "scheduled_transfers_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_transfers" ADD CONSTRAINT "scheduled_transfers_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_transfers" ADD CONSTRAINT "scheduled_transfers_destination_beneficiary_id_fkey" FOREIGN KEY ("destination_beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_transfers" ADD CONSTRAINT "scheduled_transfers_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

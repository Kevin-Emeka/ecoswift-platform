-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_role_id" UUID;

-- CreateTable
CREATE TABLE "role_assignment_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignment_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_assignment_approvals_status_idx" ON "role_assignment_approvals"("status");

-- CreateIndex
CREATE INDEX "role_assignment_approvals_user_id_idx" ON "role_assignment_approvals"("user_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment_approvals" ADD CONSTRAINT "role_assignment_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment_approvals" ADD CONSTRAINT "role_assignment_approvals_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment_approvals" ADD CONSTRAINT "role_assignment_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment_approvals" ADD CONSTRAINT "role_assignment_approvals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

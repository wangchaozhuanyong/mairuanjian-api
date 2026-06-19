CREATE TYPE "AppleAccountStatusCheckType" AS ENUM ('manual', 'automation');

CREATE TABLE "apple_account_status_checks" (
    "id" UUID NOT NULL,
    "apple_account_id" UUID NOT NULL,
    "check_type" "AppleAccountStatusCheckType" NOT NULL DEFAULT 'manual',
    "result_status" "AppleAccountStatus" NOT NULL,
    "balance_snapshot" DECIMAL(18,4),
    "remark" TEXT,
    "evidence_attachment_id" UUID,
    "operator_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_account_status_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "apple_account_status_checks_apple_account_id_idx" ON "apple_account_status_checks"("apple_account_id");

CREATE INDEX "apple_account_status_checks_check_type_idx" ON "apple_account_status_checks"("check_type");

CREATE INDEX "apple_account_status_checks_result_status_idx" ON "apple_account_status_checks"("result_status");

CREATE INDEX "apple_account_status_checks_evidence_attachment_id_idx" ON "apple_account_status_checks"("evidence_attachment_id");

CREATE INDEX "apple_account_status_checks_operator_id_idx" ON "apple_account_status_checks"("operator_id");

CREATE INDEX "apple_account_status_checks_created_at_idx" ON "apple_account_status_checks"("created_at");

ALTER TABLE "apple_account_status_checks" ADD CONSTRAINT "apple_account_status_checks_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "apple_account_status_checks" ADD CONSTRAINT "apple_account_status_checks_evidence_attachment_id_fkey" FOREIGN KEY ("evidence_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_account_status_checks" ADD CONSTRAINT "apple_account_status_checks_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

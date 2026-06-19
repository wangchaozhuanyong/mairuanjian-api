CREATE TYPE "AppleBalanceAdjustmentCostMethod" AS ENUM ('none', 'current_avg', 'manual');

CREATE TABLE "apple_balance_adjustments" (
    "id" UUID NOT NULL,
    "apple_account_id" UUID NOT NULL,
    "old_balance" DECIMAL(18,4) NOT NULL,
    "new_balance" DECIMAL(18,4) NOT NULL,
    "difference" DECIMAL(18,4) NOT NULL,
    "old_cost_rmb" DECIMAL(18,4) NOT NULL,
    "new_cost_rmb" DECIMAL(18,4) NOT NULL,
    "cost_adjust_method" "AppleBalanceAdjustmentCostMethod" NOT NULL,
    "cost_rmb_change" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_attachment_id" UUID,
    "operator_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_balance_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "apple_balance_adjustments_apple_account_id_idx" ON "apple_balance_adjustments"("apple_account_id");

CREATE INDEX "apple_balance_adjustments_cost_adjust_method_idx" ON "apple_balance_adjustments"("cost_adjust_method");

CREATE INDEX "apple_balance_adjustments_evidence_attachment_id_idx" ON "apple_balance_adjustments"("evidence_attachment_id");

CREATE INDEX "apple_balance_adjustments_operator_id_idx" ON "apple_balance_adjustments"("operator_id");

CREATE INDEX "apple_balance_adjustments_created_at_idx" ON "apple_balance_adjustments"("created_at");

ALTER TABLE "apple_balance_adjustments" ADD CONSTRAINT "apple_balance_adjustments_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "apple_balance_adjustments" ADD CONSTRAINT "apple_balance_adjustments_evidence_attachment_id_fkey" FOREIGN KEY ("evidence_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_balance_adjustments" ADD CONSTRAINT "apple_balance_adjustments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

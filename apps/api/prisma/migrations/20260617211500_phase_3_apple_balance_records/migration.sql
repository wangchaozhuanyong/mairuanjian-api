-- CreateTable
CREATE TABLE "apple_balance_topups" (
    "id" UUID NOT NULL,
    "apple_account_id" UUID NOT NULL,
    "face_value" DECIMAL(18,4) NOT NULL,
    "cost_amount" DECIMAL(18,4) NOT NULL,
    "balance_before" DECIMAL(18,4) NOT NULL,
    "balance_after" DECIMAL(18,4) NOT NULL,
    "cost_before" DECIMAL(18,4) NOT NULL,
    "cost_after" DECIMAL(18,4) NOT NULL,
    "avg_cost_before" DECIMAL(18,8) NOT NULL,
    "avg_cost_after" DECIMAL(18,8) NOT NULL,
    "gift_card_code_encrypted" TEXT,
    "gift_card_code_hash" VARCHAR(128),
    "gift_card_code_tail" VARCHAR(8),
    "remark" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_balance_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apple_balance_consumptions" (
    "id" UUID NOT NULL,
    "apple_account_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "cost_amount" DECIMAL(18,4) NOT NULL,
    "avg_unit_cost" DECIMAL(18,8) NOT NULL,
    "balance_before" DECIMAL(18,4) NOT NULL,
    "balance_after" DECIMAL(18,4) NOT NULL,
    "cost_before" DECIMAL(18,4) NOT NULL,
    "cost_after" DECIMAL(18,4) NOT NULL,
    "reason" VARCHAR(120),
    "related_object_type" VARCHAR(120),
    "related_object_id" UUID,
    "remark" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_balance_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apple_balance_topups_gift_card_code_hash_key" ON "apple_balance_topups"("gift_card_code_hash");

-- CreateIndex
CREATE INDEX "apple_balance_topups_apple_account_id_idx" ON "apple_balance_topups"("apple_account_id");

-- CreateIndex
CREATE INDEX "apple_balance_topups_created_at_idx" ON "apple_balance_topups"("created_at");

-- CreateIndex
CREATE INDEX "apple_balance_consumptions_apple_account_id_idx" ON "apple_balance_consumptions"("apple_account_id");

-- CreateIndex
CREATE INDEX "apple_balance_consumptions_created_at_idx" ON "apple_balance_consumptions"("created_at");

-- AddForeignKey
ALTER TABLE "apple_balance_topups" ADD CONSTRAINT "apple_balance_topups_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_balance_topups" ADD CONSTRAINT "apple_balance_topups_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_balance_consumptions" ADD CONSTRAINT "apple_balance_consumptions_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_balance_consumptions" ADD CONSTRAINT "apple_balance_consumptions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

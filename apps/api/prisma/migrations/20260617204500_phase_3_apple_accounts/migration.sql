-- CreateEnum
CREATE TYPE "AppleAccountStatus" AS ENUM ('normal', 'need_verify', 'locked', 'password_error', 'risk', 'unknown');

-- CreateTable
CREATE TABLE "apple_accounts" (
    "id" UUID NOT NULL,
    "apple_id" VARCHAR(255) NOT NULL,
    "apple_id_normalized" VARCHAR(255) NOT NULL,
    "region" VARCHAR(50) NOT NULL DEFAULT 'US',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "current_balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance_cost_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "status" "AppleAccountStatus" NOT NULL DEFAULT 'normal',
    "is_manually_locked" BOOLEAN NOT NULL DEFAULT false,
    "manual_lock_reason" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by_user_id" UUID,
    "password_encrypted" TEXT,
    "security_info_encrypted" TEXT,
    "phone_encrypted" TEXT,
    "recovery_email_encrypted" TEXT,
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "apple_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apple_accounts_apple_id_normalized_key" ON "apple_accounts"("apple_id_normalized");

-- CreateIndex
CREATE INDEX "apple_accounts_status_idx" ON "apple_accounts"("status");

-- CreateIndex
CREATE INDEX "apple_accounts_currency_idx" ON "apple_accounts"("currency");

-- CreateIndex
CREATE INDEX "apple_accounts_is_manually_locked_idx" ON "apple_accounts"("is_manually_locked");

-- CreateIndex
CREATE INDEX "apple_accounts_deleted_at_idx" ON "apple_accounts"("deleted_at");

-- AddForeignKey
ALTER TABLE "apple_accounts" ADD CONSTRAINT "apple_accounts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_accounts" ADD CONSTRAINT "apple_accounts_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_accounts" ADD CONSTRAINT "apple_accounts_locked_by_user_id_fkey" FOREIGN KEY ("locked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

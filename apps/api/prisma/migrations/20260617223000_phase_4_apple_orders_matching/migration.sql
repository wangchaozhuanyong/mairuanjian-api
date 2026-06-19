-- CreateEnum
CREATE TYPE "AppleServiceStatus" AS ENUM ('enabled', 'paused', 'disabled');

-- CreateEnum
CREATE TYPE "AppleServicePeriodType" AS ENUM ('month', 'day', 'manual');

-- CreateEnum
CREATE TYPE "AppleServiceExpireCalcType" AS ENUM ('by_month', 'by_day', 'manual');

-- CreateEnum
CREATE TYPE "AppleServiceLockRule" AS ENUM ('by_service', 'global');

-- CreateEnum
CREATE TYPE "AppleOrderStatus" AS ENUM ('pending', 'active', 'completed', 'cancelled', 'abnormal');

-- CreateEnum
CREATE TYPE "ServiceActivationStatus" AS ENUM ('active', 'expired', 'cancelled', 'abnormal');

-- CreateEnum
CREATE TYPE "AutoRenewStatus" AS ENUM ('enabled', 'disabled', 'unknown');

-- CreateEnum
CREATE TYPE "RenewalDecision" AS ENUM ('unconfirmed', 'renew', 'no_renew', 'change_plan');

-- CreateEnum
CREATE TYPE "AppleAccountLockScope" AS ENUM ('by_service', 'global');

-- CreateEnum
CREATE TYPE "AppleAccountLockStatus" AS ENUM ('active', 'released', 'expired');

-- CreateTable
CREATE TABLE "apple_services" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80) NOT NULL DEFAULT 'default',
    "default_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "official_cost_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "default_period_type" "AppleServicePeriodType" NOT NULL DEFAULT 'month',
    "default_period_value" INTEGER NOT NULL DEFAULT 1,
    "expire_calc_type" "AppleServiceExpireCalcType" NOT NULL DEFAULT 'by_month',
    "require_apple_id" BOOLEAN NOT NULL DEFAULT true,
    "require_service_account" BOOLEAN NOT NULL DEFAULT false,
    "auto_match_apple_id" BOOLEAN NOT NULL DEFAULT true,
    "lock_rule" "AppleServiceLockRule" NOT NULL DEFAULT 'by_service',
    "allowed_regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "min_balance_required" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "AppleServiceStatus" NOT NULL DEFAULT 'enabled',
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "apple_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apple_orders" (
    "id" UUID NOT NULL,
    "order_no" VARCHAR(40) NOT NULL,
    "customer_id" UUID NOT NULL,
    "source_platform_id" UUID,
    "external_order_no" VARCHAR(120),
    "service_id" UUID NOT NULL,
    "apple_account_id" UUID,
    "service_account" VARCHAR(255),
    "current_plan" VARCHAR(120),
    "target_plan" VARCHAR(120),
    "start_time" TIMESTAMPTZ(6),
    "expire_time" TIMESTAMPTZ(6),
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "platform_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refund_loss" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "apple_cost_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "apple_cost_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "profit_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "AppleOrderStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "apple_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_activations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "apple_account_id" UUID,
    "service_id" UUID NOT NULL,
    "current_plan" VARCHAR(120),
    "target_plan" VARCHAR(120),
    "start_time" TIMESTAMPTZ(6),
    "expire_time" TIMESTAMPTZ(6),
    "consumed_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "avg_unit_cost" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "cost_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "platform_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refund_loss" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "profit_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "source_platform_id" UUID,
    "external_order_no" VARCHAR(120),
    "status" "ServiceActivationStatus" NOT NULL DEFAULT 'active',
    "auto_renew_status" "AutoRenewStatus" NOT NULL DEFAULT 'unknown',
    "renewal_decision" "RenewalDecision" NOT NULL DEFAULT 'unconfirmed',
    "renewal_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apple_account_locks" (
    "id" UUID NOT NULL,
    "apple_account_id" UUID NOT NULL,
    "service_id" UUID,
    "order_id" UUID,
    "lock_scope" "AppleAccountLockScope" NOT NULL DEFAULT 'by_service',
    "status" "AppleAccountLockStatus" NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "locked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "apple_account_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apple_services_category_idx" ON "apple_services"("category");

-- CreateIndex
CREATE INDEX "apple_services_currency_idx" ON "apple_services"("currency");

-- CreateIndex
CREATE INDEX "apple_services_status_idx" ON "apple_services"("status");

-- CreateIndex
CREATE INDEX "apple_services_deleted_at_idx" ON "apple_services"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "apple_orders_order_no_key" ON "apple_orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "apple_orders_source_platform_id_external_order_no_key" ON "apple_orders"("source_platform_id", "external_order_no");

-- CreateIndex
CREATE INDEX "apple_orders_customer_id_idx" ON "apple_orders"("customer_id");

-- CreateIndex
CREATE INDEX "apple_orders_source_platform_id_idx" ON "apple_orders"("source_platform_id");

-- CreateIndex
CREATE INDEX "apple_orders_service_id_idx" ON "apple_orders"("service_id");

-- CreateIndex
CREATE INDEX "apple_orders_apple_account_id_idx" ON "apple_orders"("apple_account_id");

-- CreateIndex
CREATE INDEX "apple_orders_status_idx" ON "apple_orders"("status");

-- CreateIndex
CREATE INDEX "apple_orders_created_at_idx" ON "apple_orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_activations_order_id_key" ON "service_activations"("order_id");

-- CreateIndex
CREATE INDEX "service_activations_customer_id_idx" ON "service_activations"("customer_id");

-- CreateIndex
CREATE INDEX "service_activations_apple_account_id_idx" ON "service_activations"("apple_account_id");

-- CreateIndex
CREATE INDEX "service_activations_service_id_idx" ON "service_activations"("service_id");

-- CreateIndex
CREATE INDEX "service_activations_expire_time_idx" ON "service_activations"("expire_time");

-- CreateIndex
CREATE INDEX "service_activations_status_idx" ON "service_activations"("status");

-- CreateIndex
CREATE INDEX "apple_account_locks_apple_account_id_status_idx" ON "apple_account_locks"("apple_account_id", "status");

-- CreateIndex
CREATE INDEX "apple_account_locks_service_id_status_idx" ON "apple_account_locks"("service_id", "status");

-- CreateIndex
CREATE INDEX "apple_account_locks_order_id_idx" ON "apple_account_locks"("order_id");

-- CreateIndex
CREATE INDEX "apple_account_locks_lock_scope_status_idx" ON "apple_account_locks"("lock_scope", "status");

-- AddForeignKey
ALTER TABLE "apple_services" ADD CONSTRAINT "apple_services_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_services" ADD CONSTRAINT "apple_services_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_orders" ADD CONSTRAINT "apple_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_orders" ADD CONSTRAINT "apple_orders_source_platform_id_fkey" FOREIGN KEY ("source_platform_id") REFERENCES "source_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_orders" ADD CONSTRAINT "apple_orders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "apple_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_orders" ADD CONSTRAINT "apple_orders_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_orders" ADD CONSTRAINT "apple_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_orders" ADD CONSTRAINT "apple_orders_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_activations" ADD CONSTRAINT "service_activations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "apple_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_activations" ADD CONSTRAINT "service_activations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_activations" ADD CONSTRAINT "service_activations_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_activations" ADD CONSTRAINT "service_activations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "apple_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_activations" ADD CONSTRAINT "service_activations_source_platform_id_fkey" FOREIGN KEY ("source_platform_id") REFERENCES "source_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_locks" ADD CONSTRAINT "apple_account_locks_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_locks" ADD CONSTRAINT "apple_account_locks_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "apple_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_locks" ADD CONSTRAINT "apple_account_locks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "apple_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_locks" ADD CONSTRAINT "apple_account_locks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

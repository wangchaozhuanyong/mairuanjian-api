-- CreateEnum
CREATE TYPE "AppleActionPlanStatus" AS ENUM ('pending', 'processing', 'completed', 'abnormal');

-- CreateEnum
CREATE TYPE "AppleActionPlanItemActionType" AS ENUM ('renew', 'cancel', 'change_plan', 'wait_customer');

-- CreateEnum
CREATE TYPE "AppleActionPlanItemStatus" AS ENUM ('pending', 'completed', 'abnormal');

-- CreateTable
CREATE TABLE "apple_account_action_plans" (
    "id" UUID NOT NULL,
    "apple_account_id" UUID NOT NULL,
    "plan_date" DATE NOT NULL,
    "current_balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "avg_unit_cost" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "active_service_count" INTEGER NOT NULL DEFAULT 0,
    "renew_services_count" INTEGER NOT NULL DEFAULT 0,
    "cancel_services_count" INTEGER NOT NULL DEFAULT 0,
    "pending_customer_count" INTEGER NOT NULL DEFAULT 0,
    "required_renewal_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "suggested_topup_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "has_wrong_charge_risk" BOOLEAN NOT NULL DEFAULT false,
    "status" "AppleActionPlanStatus" NOT NULL DEFAULT 'pending',
    "main_note" TEXT,
    "created_by_user_id" UUID,
    "completed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "apple_account_action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apple_account_action_plan_items" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "activation_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "current_plan" VARCHAR(120),
    "target_plan" VARCHAR(120),
    "expire_time" TIMESTAMPTZ(6),
    "customer_decision" "RenewalDecision" NOT NULL DEFAULT 'unconfirmed',
    "action_type" "AppleActionPlanItemActionType" NOT NULL,
    "expected_charge_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cancel_deadline" TIMESTAMPTZ(6),
    "task_id" UUID,
    "status" "AppleActionPlanItemStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "appleOrderId" UUID,

    CONSTRAINT "apple_account_action_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apple_account_action_plans_plan_date_idx" ON "apple_account_action_plans"("plan_date");

-- CreateIndex
CREATE INDEX "apple_account_action_plans_status_idx" ON "apple_account_action_plans"("status");

-- CreateIndex
CREATE INDEX "apple_account_action_plans_has_wrong_charge_risk_idx" ON "apple_account_action_plans"("has_wrong_charge_risk");

-- CreateIndex
CREATE UNIQUE INDEX "apple_account_action_plans_apple_account_id_plan_date_key" ON "apple_account_action_plans"("apple_account_id", "plan_date");

-- CreateIndex
CREATE INDEX "apple_account_action_plan_items_plan_id_idx" ON "apple_account_action_plan_items"("plan_id");

-- CreateIndex
CREATE INDEX "apple_account_action_plan_items_activation_id_idx" ON "apple_account_action_plan_items"("activation_id");

-- CreateIndex
CREATE INDEX "apple_account_action_plan_items_customer_id_idx" ON "apple_account_action_plan_items"("customer_id");

-- CreateIndex
CREATE INDEX "apple_account_action_plan_items_service_id_idx" ON "apple_account_action_plan_items"("service_id");

-- CreateIndex
CREATE INDEX "apple_account_action_plan_items_task_id_idx" ON "apple_account_action_plan_items"("task_id");

-- CreateIndex
CREATE INDEX "apple_account_action_plan_items_action_type_idx" ON "apple_account_action_plan_items"("action_type");

-- CreateIndex
CREATE INDEX "apple_account_action_plan_items_status_idx" ON "apple_account_action_plan_items"("status");

-- AddForeignKey
ALTER TABLE "apple_account_action_plans" ADD CONSTRAINT "apple_account_action_plans_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plans" ADD CONSTRAINT "apple_account_action_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plans" ADD CONSTRAINT "apple_account_action_plans_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plan_items" ADD CONSTRAINT "apple_account_action_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "apple_account_action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plan_items" ADD CONSTRAINT "apple_account_action_plan_items_activation_id_fkey" FOREIGN KEY ("activation_id") REFERENCES "service_activations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plan_items" ADD CONSTRAINT "apple_account_action_plan_items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plan_items" ADD CONSTRAINT "apple_account_action_plan_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "apple_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plan_items" ADD CONSTRAINT "apple_account_action_plan_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "renewal_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_account_action_plan_items" ADD CONSTRAINT "apple_account_action_plan_items_appleOrderId_fkey" FOREIGN KEY ("appleOrderId") REFERENCES "apple_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

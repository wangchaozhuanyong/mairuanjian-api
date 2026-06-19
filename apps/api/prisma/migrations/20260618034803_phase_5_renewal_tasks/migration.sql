-- CreateEnum
CREATE TYPE "RenewalTaskType" AS ENUM ('contact_customer', 'remind_customer_reply', 'confirm_payment', 'topup_apple_balance', 'check_balance', 'cancel_subscription', 'change_plan', 'wait_auto_renewal', 'check_renewal_result', 'notify_customer', 'handle_abnormal', 'after_sale');

-- CreateEnum
CREATE TYPE "RenewalTaskStatus" AS ENUM ('pending', 'processing', 'waiting_customer', 'waiting_payment', 'waiting_auto_renewal', 'waiting_manual_verify', 'completed', 'cancelled', 'failed', 'abnormal', 'postponed');

-- CreateEnum
CREATE TYPE "RenewalTaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "RenewalTaskCustomerDecision" AS ENUM ('not_contacted', 'contacted_waiting_reply', 'confirmed_renewal', 'confirmed_no_renewal', 'change_plan', 'considering', 'paid', 'unpaid', 'cancelled', 'renewed_success', 'abnormal');

-- CreateTable
CREATE TABLE "renewal_tasks" (
    "id" UUID NOT NULL,
    "task_type" "RenewalTaskType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "status" "RenewalTaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "RenewalTaskPriority" NOT NULL DEFAULT 'medium',
    "customer_id" UUID NOT NULL,
    "apple_account_id" UUID,
    "service_id" UUID NOT NULL,
    "activation_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "current_plan" VARCHAR(120),
    "target_plan" VARCHAR(120),
    "customer_decision" "RenewalTaskCustomerDecision" NOT NULL DEFAULT 'not_contacted',
    "required_action" VARCHAR(160),
    "current_balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "expected_charge_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "suggested_topup_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "expected_charge_time" TIMESTAMPTZ(6),
    "cancel_deadline" TIMESTAMPTZ(6),
    "remind_at" TIMESTAMPTZ(6),
    "due_at" TIMESTAMPTZ(6),
    "assigned_to" UUID,
    "note" TEXT,
    "result_note" TEXT,
    "evidence_attachment_id" UUID,
    "created_by" UUID,
    "completed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "renewal_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renewal_tasks_status_idx" ON "renewal_tasks"("status");

-- CreateIndex
CREATE INDEX "renewal_tasks_task_type_idx" ON "renewal_tasks"("task_type");

-- CreateIndex
CREATE INDEX "renewal_tasks_priority_idx" ON "renewal_tasks"("priority");

-- CreateIndex
CREATE INDEX "renewal_tasks_customer_id_idx" ON "renewal_tasks"("customer_id");

-- CreateIndex
CREATE INDEX "renewal_tasks_apple_account_id_idx" ON "renewal_tasks"("apple_account_id");

-- CreateIndex
CREATE INDEX "renewal_tasks_service_id_idx" ON "renewal_tasks"("service_id");

-- CreateIndex
CREATE INDEX "renewal_tasks_activation_id_idx" ON "renewal_tasks"("activation_id");

-- CreateIndex
CREATE INDEX "renewal_tasks_order_id_idx" ON "renewal_tasks"("order_id");

-- CreateIndex
CREATE INDEX "renewal_tasks_due_at_idx" ON "renewal_tasks"("due_at");

-- CreateIndex
CREATE INDEX "renewal_tasks_assigned_to_idx" ON "renewal_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "renewal_tasks_customer_decision_idx" ON "renewal_tasks"("customer_decision");

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "apple_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_activation_id_fkey" FOREIGN KEY ("activation_id") REFERENCES "service_activations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "apple_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_tasks" ADD CONSTRAINT "renewal_tasks_evidence_attachment_id_fkey" FOREIGN KEY ("evidence_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

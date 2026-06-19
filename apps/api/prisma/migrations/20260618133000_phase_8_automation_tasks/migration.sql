-- CreateEnum
CREATE TYPE "AutomationTaskType" AS ENUM ('check_status', 'check_balance', 'topup', 'cancel_subscription', 'change_phone', 'change_security', 'check_renewal');

-- CreateEnum
CREATE TYPE "AutomationTaskStatus" AS ENUM ('pending', 'queued', 'running', 'waiting_manual_verify', 'success', 'failed', 'skipped', 'cancelled', 'need_review');

-- CreateEnum
CREATE TYPE "AutomationTaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "AutomationTaskLogLevel" AS ENUM ('info', 'warning', 'error', 'success');

-- CreateTable
CREATE TABLE "automation_tasks" (
    "id" UUID NOT NULL,
    "task_type" "AutomationTaskType" NOT NULL,
    "apple_account_id" UUID NOT NULL,
    "customer_id" UUID,
    "service_id" UUID,
    "activation_id" UUID,
    "priority" "AutomationTaskPriority" NOT NULL DEFAULT 'medium',
    "status" "AutomationTaskStatus" NOT NULL DEFAULT 'pending',
    "input_payload_encrypted" TEXT,
    "result_payload" JSONB,
    "screenshot_attachment_id" UUID,
    "error_code" VARCHAR(120),
    "error_message" TEXT,
    "created_by" UUID,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "manual_required" BOOLEAN NOT NULL DEFAULT false,
    "queue_job_id" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "automation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_task_logs" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "level" "AutomationTaskLogLevel" NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "screenshot_attachment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_tasks_task_type_idx" ON "automation_tasks"("task_type");

-- CreateIndex
CREATE INDEX "automation_tasks_status_idx" ON "automation_tasks"("status");

-- CreateIndex
CREATE INDEX "automation_tasks_priority_idx" ON "automation_tasks"("priority");

-- CreateIndex
CREATE INDEX "automation_tasks_apple_account_id_idx" ON "automation_tasks"("apple_account_id");

-- CreateIndex
CREATE INDEX "automation_tasks_customer_id_idx" ON "automation_tasks"("customer_id");

-- CreateIndex
CREATE INDEX "automation_tasks_service_id_idx" ON "automation_tasks"("service_id");

-- CreateIndex
CREATE INDEX "automation_tasks_activation_id_idx" ON "automation_tasks"("activation_id");

-- CreateIndex
CREATE INDEX "automation_tasks_manual_required_idx" ON "automation_tasks"("manual_required");

-- CreateIndex
CREATE INDEX "automation_tasks_created_at_idx" ON "automation_tasks"("created_at");

-- CreateIndex
CREATE INDEX "automation_task_logs_task_id_idx" ON "automation_task_logs"("task_id");

-- CreateIndex
CREATE INDEX "automation_task_logs_level_idx" ON "automation_task_logs"("level");

-- CreateIndex
CREATE INDEX "automation_task_logs_created_at_idx" ON "automation_task_logs"("created_at");

-- AddForeignKey
ALTER TABLE "automation_tasks" ADD CONSTRAINT "automation_tasks_apple_account_id_fkey" FOREIGN KEY ("apple_account_id") REFERENCES "apple_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_tasks" ADD CONSTRAINT "automation_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_tasks" ADD CONSTRAINT "automation_tasks_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "apple_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_tasks" ADD CONSTRAINT "automation_tasks_activation_id_fkey" FOREIGN KEY ("activation_id") REFERENCES "service_activations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_tasks" ADD CONSTRAINT "automation_tasks_screenshot_attachment_id_fkey" FOREIGN KEY ("screenshot_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_tasks" ADD CONSTRAINT "automation_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_task_logs" ADD CONSTRAINT "automation_task_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "automation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_task_logs" ADD CONSTRAINT "automation_task_logs_screenshot_attachment_id_fkey" FOREIGN KEY ("screenshot_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

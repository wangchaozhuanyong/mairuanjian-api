CREATE TYPE "AutomationTaskBatchType" AS ENUM ('status_check', 'balance_check', 'official_price_check');

CREATE TABLE "automation_task_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batch_type" "AutomationTaskBatchType" NOT NULL,
  "status" "AutomationTaskStatus" NOT NULL DEFAULT 'queued',
  "total_count" INTEGER NOT NULL DEFAULT 0,
  "queued_count" INTEGER NOT NULL DEFAULT 0,
  "running_count" INTEGER NOT NULL DEFAULT 0,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "manual_required_count" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "created_by_user_id" UUID,
  "started_at" TIMESTAMPTZ(6),
  "finished_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "automation_task_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automation_task_batches_batch_type_idx"
  ON "automation_task_batches"("batch_type");
CREATE INDEX "automation_task_batches_status_idx"
  ON "automation_task_batches"("status");
CREATE INDEX "automation_task_batches_created_at_idx"
  ON "automation_task_batches"("created_at");

ALTER TABLE "automation_task_batches"
  ADD CONSTRAINT "automation_task_batches_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "automation_tasks"
  ADD COLUMN "batch_id" UUID;

CREATE INDEX "automation_tasks_batch_id_idx"
  ON "automation_tasks"("batch_id");

ALTER TABLE "automation_tasks"
  ADD CONSTRAINT "automation_tasks_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "automation_task_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_official_price_snapshots"
  ADD COLUMN "automation_task_id" UUID;

CREATE INDEX "apple_official_price_snapshots_automation_task_id_idx"
  ON "apple_official_price_snapshots"("automation_task_id");

ALTER TABLE "apple_official_price_snapshots"
  ADD CONSTRAINT "apple_official_price_snapshots_automation_task_id_fkey"
  FOREIGN KEY ("automation_task_id") REFERENCES "automation_tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_price_change_reviews"
  ADD COLUMN "automation_task_id" UUID;

CREATE INDEX "apple_price_change_reviews_automation_task_id_idx"
  ON "apple_price_change_reviews"("automation_task_id");

ALTER TABLE "apple_price_change_reviews"
  ADD CONSTRAINT "apple_price_change_reviews_automation_task_id_fkey"
  FOREIGN KEY ("automation_task_id") REFERENCES "automation_tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

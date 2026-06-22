CREATE TABLE "apple_official_price_check_batches" (
    "id" UUID NOT NULL,
    "scope_key" VARCHAR(240) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "trigger" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "scan_removed_plans" BOOLEAN NOT NULL DEFAULT false,
    "status" "AutomationTaskStatus" NOT NULL DEFAULT 'queued',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "manual_required_count" INTEGER NOT NULL DEFAULT 0,
    "snapshot_count" INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "pending_review_count" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error_message" TEXT,
    "created_by_user_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_official_price_check_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "apple_official_price_check_batch_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "source_name" VARCHAR(120) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "region" VARCHAR(20) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "status" "AutomationTaskStatus" NOT NULL DEFAULT 'queued',
    "task_id" UUID,
    "snapshot_count" INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_official_price_check_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "apple_official_price_check_batches_scope_key_status_idx"
  ON "apple_official_price_check_batches"("scope_key", "status");
CREATE INDEX "apple_official_price_check_batches_provider_idx"
  ON "apple_official_price_check_batches"("provider");
CREATE INDEX "apple_official_price_check_batches_status_idx"
  ON "apple_official_price_check_batches"("status");
CREATE INDEX "apple_official_price_check_batches_created_at_idx"
  ON "apple_official_price_check_batches"("created_at");

CREATE UNIQUE INDEX "apple_official_price_check_batch_items_batch_id_provider_region_currency_key"
  ON "apple_official_price_check_batch_items"("batch_id", "provider", "region", "currency");
CREATE INDEX "apple_official_price_check_batch_items_batch_id_idx"
  ON "apple_official_price_check_batch_items"("batch_id");
CREATE INDEX "apple_official_price_check_batch_items_source_id_idx"
  ON "apple_official_price_check_batch_items"("source_id");
CREATE INDEX "apple_official_price_check_batch_items_provider_region_currency_idx"
  ON "apple_official_price_check_batch_items"("provider", "region", "currency");
CREATE INDEX "apple_official_price_check_batch_items_status_idx"
  ON "apple_official_price_check_batch_items"("status");
CREATE INDEX "apple_official_price_check_batch_items_created_at_idx"
  ON "apple_official_price_check_batch_items"("created_at");

ALTER TABLE "apple_official_price_check_batch_items"
  ADD CONSTRAINT "apple_official_price_check_batch_items_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "apple_official_price_check_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

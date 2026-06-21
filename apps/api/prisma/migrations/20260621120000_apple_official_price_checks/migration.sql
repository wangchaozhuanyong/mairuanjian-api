-- Extend automation task types for Apple ID official price checks.
ALTER TYPE "AutomationTaskType" ADD VALUE 'official_price_check';

-- Allow system-level automation tasks that are not tied to one Apple ID account.
ALTER TABLE "automation_tasks" ALTER COLUMN "apple_account_id" DROP NOT NULL;

-- Create enums for official price source collection and review workflow.
CREATE TYPE "AppleOfficialPriceSourceStatus" AS ENUM ('enabled', 'disabled');
CREATE TYPE "AppleOfficialPriceCollectMethod" AS ENUM ('manual', 'webpage', 'api');
CREATE TYPE "ApplePriceChangeType" AS ENUM (
    'price_changed',
    'new_plan',
    'removed_plan',
    'period_changed',
    'currency_changed'
);
CREATE TYPE "ApplePriceChangeReviewStatus" AS ENUM ('pending', 'approved', 'ignored');

CREATE TABLE "apple_official_price_sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "region" VARCHAR(20) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "source_url" TEXT,
    "collect_method" "AppleOfficialPriceCollectMethod" NOT NULL DEFAULT 'manual',
    "check_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "status" "AppleOfficialPriceSourceStatus" NOT NULL DEFAULT 'enabled',
    "last_checked_at" TIMESTAMPTZ(6),
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "apple_official_price_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "apple_official_price_snapshots" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "apple_service_id" UUID,
    "service_name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80) NOT NULL DEFAULT '通用',
    "region" VARCHAR(20) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "official_price" DECIMAL(18,4) NOT NULL,
    "period_type" "AppleServicePeriodType" NOT NULL DEFAULT 'month',
    "period_value" INTEGER NOT NULL DEFAULT 1,
    "raw_payload" JSONB,
    "collected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_official_price_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "apple_price_change_reviews" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "snapshot_id" UUID,
    "apple_service_id" UUID,
    "change_type" "ApplePriceChangeType" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB NOT NULL,
    "status" "ApplePriceChangeReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "remark" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "apple_price_change_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "apple_official_price_sources_region_idx" ON "apple_official_price_sources"("region");
CREATE INDEX "apple_official_price_sources_currency_idx" ON "apple_official_price_sources"("currency");
CREATE INDEX "apple_official_price_sources_collect_method_idx" ON "apple_official_price_sources"("collect_method");
CREATE INDEX "apple_official_price_sources_status_idx" ON "apple_official_price_sources"("status");
CREATE INDEX "apple_official_price_sources_last_checked_at_idx" ON "apple_official_price_sources"("last_checked_at");
CREATE INDEX "apple_official_price_sources_deleted_at_idx" ON "apple_official_price_sources"("deleted_at");

CREATE INDEX "apple_official_price_snapshots_source_id_idx" ON "apple_official_price_snapshots"("source_id");
CREATE INDEX "apple_official_price_snapshots_apple_service_id_idx" ON "apple_official_price_snapshots"("apple_service_id");
CREATE INDEX "apple_official_price_snapshots_service_name_idx" ON "apple_official_price_snapshots"("service_name");
CREATE INDEX "apple_official_price_snapshots_region_idx" ON "apple_official_price_snapshots"("region");
CREATE INDEX "apple_official_price_snapshots_currency_idx" ON "apple_official_price_snapshots"("currency");
CREATE INDEX "apple_official_price_snapshots_collected_at_idx" ON "apple_official_price_snapshots"("collected_at");

CREATE INDEX "apple_price_change_reviews_source_id_idx" ON "apple_price_change_reviews"("source_id");
CREATE INDEX "apple_price_change_reviews_snapshot_id_idx" ON "apple_price_change_reviews"("snapshot_id");
CREATE INDEX "apple_price_change_reviews_apple_service_id_idx" ON "apple_price_change_reviews"("apple_service_id");
CREATE INDEX "apple_price_change_reviews_change_type_idx" ON "apple_price_change_reviews"("change_type");
CREATE INDEX "apple_price_change_reviews_status_idx" ON "apple_price_change_reviews"("status");
CREATE INDEX "apple_price_change_reviews_created_at_idx" ON "apple_price_change_reviews"("created_at");

ALTER TABLE "apple_official_price_sources" ADD CONSTRAINT "apple_official_price_sources_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "apple_official_price_sources" ADD CONSTRAINT "apple_official_price_sources_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_official_price_snapshots" ADD CONSTRAINT "apple_official_price_snapshots_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "apple_official_price_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "apple_official_price_snapshots" ADD CONSTRAINT "apple_official_price_snapshots_apple_service_id_fkey" FOREIGN KEY ("apple_service_id") REFERENCES "apple_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_price_change_reviews" ADD CONSTRAINT "apple_price_change_reviews_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "apple_official_price_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "apple_price_change_reviews" ADD CONSTRAINT "apple_price_change_reviews_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "apple_official_price_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "apple_price_change_reviews" ADD CONSTRAINT "apple_price_change_reviews_apple_service_id_fkey" FOREIGN KEY ("apple_service_id") REFERENCES "apple_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "apple_price_change_reviews" ADD CONSTRAINT "apple_price_change_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

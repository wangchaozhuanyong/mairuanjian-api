CREATE TYPE "AppleServiceRegionPriceStatus" AS ENUM ('active', 'disabled', 'needs_review');

CREATE TABLE "apple_service_region_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "service_id" UUID NOT NULL,
  "source_snapshot_id" UUID,
  "provider" VARCHAR(40) NOT NULL DEFAULT 'manual',
  "service_name" VARCHAR(120) NOT NULL,
  "category" VARCHAR(80) NOT NULL DEFAULT '通用',
  "region" VARCHAR(20) NOT NULL,
  "currency" VARCHAR(10) NOT NULL,
  "official_price" DECIMAL(18,4) NOT NULL,
  "apple_balance_price" DECIMAL(18,4) NOT NULL,
  "period_type" "AppleServicePeriodType" NOT NULL DEFAULT 'month',
  "period_value" INTEGER NOT NULL DEFAULT 1,
  "status" "AppleServiceRegionPriceStatus" NOT NULL DEFAULT 'active',
  "collected_at" TIMESTAMPTZ(6),
  "confirmed_at" TIMESTAMPTZ(6),
  "remark" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "apple_service_region_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "apple_service_region_prices_service_id_region_currency_key"
  ON "apple_service_region_prices"("service_id", "region", "currency");
CREATE INDEX "apple_service_region_prices_service_id_idx"
  ON "apple_service_region_prices"("service_id");
CREATE INDEX "apple_service_region_prices_source_snapshot_id_idx"
  ON "apple_service_region_prices"("source_snapshot_id");
CREATE INDEX "apple_service_region_prices_region_category_status_idx"
  ON "apple_service_region_prices"("region", "category", "status");
CREATE INDEX "apple_service_region_prices_currency_idx"
  ON "apple_service_region_prices"("currency");
CREATE INDEX "apple_service_region_prices_status_idx"
  ON "apple_service_region_prices"("status");
CREATE INDEX "apple_service_region_prices_collected_at_idx"
  ON "apple_service_region_prices"("collected_at");
CREATE INDEX "apple_service_region_prices_deleted_at_idx"
  ON "apple_service_region_prices"("deleted_at");

ALTER TABLE "apple_service_region_prices"
  ADD CONSTRAINT "apple_service_region_prices_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "apple_services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "apple_service_region_prices"
  ADD CONSTRAINT "apple_service_region_prices_source_snapshot_id_fkey"
  FOREIGN KEY ("source_snapshot_id") REFERENCES "apple_official_price_snapshots"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_orders"
  ADD COLUMN "service_price_id" UUID,
  ADD COLUMN "service_region" VARCHAR(20);

CREATE INDEX "apple_orders_service_price_id_idx" ON "apple_orders"("service_price_id");
CREATE INDEX "apple_orders_service_region_idx" ON "apple_orders"("service_region");

ALTER TABLE "apple_orders"
  ADD CONSTRAINT "apple_orders_service_price_id_fkey"
  FOREIGN KEY ("service_price_id") REFERENCES "apple_service_region_prices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_activations"
  ADD COLUMN "service_price_id" UUID,
  ADD COLUMN "service_region" VARCHAR(20);

CREATE INDEX "service_activations_service_price_id_idx"
  ON "service_activations"("service_price_id");
CREATE INDEX "service_activations_service_region_idx"
  ON "service_activations"("service_region");

ALTER TABLE "service_activations"
  ADD CONSTRAINT "service_activations_service_price_id_fkey"
  FOREIGN KEY ("service_price_id") REFERENCES "apple_service_region_prices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "apple_service_region_prices" (
  "service_id",
  "provider",
  "service_name",
  "category",
  "region",
  "currency",
  "official_price",
  "apple_balance_price",
  "period_type",
  "period_value",
  "status",
  "confirmed_at",
  "remark"
)
SELECT
  "id",
  'service_setting',
  "name",
  "category",
  unnest("allowed_regions"),
  "currency",
  "official_base_price",
  "official_cost_value",
  "default_period_type",
  "default_period_value",
  CASE
    WHEN "status" = 'disabled' THEN 'disabled'::"AppleServiceRegionPriceStatus"
    ELSE 'active'::"AppleServiceRegionPriceStatus"
  END,
  CURRENT_TIMESTAMP,
  '由历史 Apple ID 业务设置地区自动回填'
FROM "apple_services"
WHERE "deleted_at" IS NULL
  AND cardinality("allowed_regions") > 0
ON CONFLICT ("service_id", "region", "currency") DO NOTHING;

INSERT INTO "apple_service_region_prices" (
  "service_id",
  "source_snapshot_id",
  "provider",
  "service_name",
  "category",
  "region",
  "currency",
  "official_price",
  "apple_balance_price",
  "period_type",
  "period_value",
  "status",
  "collected_at",
  "confirmed_at",
  "remark"
)
SELECT DISTINCT ON ("apple_service_id", "region", "currency")
  "apple_service_id",
  "id",
  "provider",
  "service_name",
  "category",
  "region",
  "currency",
  "official_price",
  COALESCE("apple_balance_price", "official_price"),
  "period_type",
  "period_value",
  'active'::"AppleServiceRegionPriceStatus",
  "collected_at",
  "collected_at",
  '由官方价格采集快照自动同步'
FROM "apple_official_price_snapshots"
WHERE "apple_service_id" IS NOT NULL
ORDER BY "apple_service_id", "region", "currency", "collected_at" DESC
ON CONFLICT ("service_id", "region", "currency")
DO UPDATE SET
  "source_snapshot_id" = EXCLUDED."source_snapshot_id",
  "provider" = EXCLUDED."provider",
  "service_name" = EXCLUDED."service_name",
  "category" = EXCLUDED."category",
  "official_price" = EXCLUDED."official_price",
  "apple_balance_price" = EXCLUDED."apple_balance_price",
  "period_type" = EXCLUDED."period_type",
  "period_value" = EXCLUDED."period_value",
  "status" = EXCLUDED."status",
  "collected_at" = EXCLUDED."collected_at",
  "confirmed_at" = EXCLUDED."confirmed_at",
  "remark" = EXCLUDED."remark",
  "updated_at" = CURRENT_TIMESTAMP;

WITH "order_price_candidates" AS (
  SELECT DISTINCT ON (orders."id")
    orders."id" AS "order_id",
    prices."id" AS "price_id",
    prices."region"
  FROM "apple_orders" AS orders
  JOIN "apple_service_region_prices" AS prices
    ON orders."service_id" = prices."service_id"
  LEFT JOIN "apple_accounts" AS accounts
    ON accounts."id" = orders."apple_account_id"
  WHERE orders."service_price_id" IS NULL
    AND prices."deleted_at" IS NULL
    AND prices."status" = 'active'
    AND (
      orders."apple_account_id" IS NULL
      OR prices."region" = accounts."region"
    )
  ORDER BY
    orders."id",
    CASE WHEN accounts."region" IS NOT NULL AND prices."region" = accounts."region" THEN 0 ELSE 1 END,
    prices."confirmed_at" DESC NULLS LAST,
    prices."updated_at" DESC
)
UPDATE "apple_orders" AS orders
SET
  "service_price_id" = candidates."price_id",
  "service_region" = candidates."region"
FROM "order_price_candidates" AS candidates
WHERE orders."id" = candidates."order_id";

UPDATE "service_activations" AS activations
SET
  "service_price_id" = orders."service_price_id",
  "service_region" = orders."service_region"
FROM "apple_orders" AS orders
WHERE activations."order_id" = orders."id"
  AND activations."service_price_id" IS NULL;

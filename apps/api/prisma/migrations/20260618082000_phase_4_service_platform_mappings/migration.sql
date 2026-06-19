CREATE TYPE "AppleServicePlatformFeeType" AS ENUM ('none', 'rate', 'fixed', 'mixed');

CREATE TABLE "apple_service_platform_mappings" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "source_platform_id" UUID NOT NULL,
    "shop_name" VARCHAR(120),
    "platform_item_id" VARCHAR(120) NOT NULL,
    "platform_sku_id" VARCHAR(120) NOT NULL DEFAULT '',
    "sku_keyword" VARCHAR(255),
    "platform_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "platform_fee_type" "AppleServicePlatformFeeType" NOT NULL DEFAULT 'none',
    "platform_fee_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allow_auto_order" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "apple_service_platform_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "apple_service_platform_mappings_service_id_source_platform_id_platform_item_id_platform_sku_id_key" ON "apple_service_platform_mappings"("service_id", "source_platform_id", "platform_item_id", "platform_sku_id");

CREATE INDEX "apple_service_platform_mappings_service_id_idx" ON "apple_service_platform_mappings"("service_id");

CREATE INDEX "apple_service_platform_mappings_source_platform_id_idx" ON "apple_service_platform_mappings"("source_platform_id");

CREATE INDEX "apple_service_platform_mappings_enabled_idx" ON "apple_service_platform_mappings"("enabled");

ALTER TABLE "apple_service_platform_mappings" ADD CONSTRAINT "apple_service_platform_mappings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "apple_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "apple_service_platform_mappings" ADD CONSTRAINT "apple_service_platform_mappings_source_platform_id_fkey" FOREIGN KEY ("source_platform_id") REFERENCES "source_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "code_platform_mappings" (
    "id" UUID NOT NULL,
    "platform_id" UUID NOT NULL,
    "shop_id" VARCHAR(120),
    "platform_item_id" VARCHAR(120) NOT NULL,
    "platform_sku_id" VARCHAR(120) NOT NULL DEFAULT '',
    "sku_keyword" VARCHAR(255),
    "service_id" UUID NOT NULL,
    "face_value" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "delivery_template_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "code_platform_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "code_platform_mappings_platform_id_platform_item_id_platform_sku_id_service_id_key" ON "code_platform_mappings"("platform_id", "platform_item_id", "platform_sku_id", "service_id");

-- CreateIndex
CREATE INDEX "code_platform_mappings_platform_id_idx" ON "code_platform_mappings"("platform_id");

-- CreateIndex
CREATE INDEX "code_platform_mappings_service_id_idx" ON "code_platform_mappings"("service_id");

-- CreateIndex
CREATE INDEX "code_platform_mappings_platform_item_id_idx" ON "code_platform_mappings"("platform_item_id");

-- CreateIndex
CREATE INDEX "code_platform_mappings_platform_sku_id_idx" ON "code_platform_mappings"("platform_sku_id");

-- CreateIndex
CREATE INDEX "code_platform_mappings_enabled_idx" ON "code_platform_mappings"("enabled");

-- AddForeignKey
ALTER TABLE "code_platform_mappings" ADD CONSTRAINT "code_platform_mappings_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "source_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_platform_mappings" ADD CONSTRAINT "code_platform_mappings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "code_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_platform_mappings" ADD CONSTRAINT "code_platform_mappings_delivery_template_id_fkey" FOREIGN KEY ("delivery_template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

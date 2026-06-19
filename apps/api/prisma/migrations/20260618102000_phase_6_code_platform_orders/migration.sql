-- CreateEnum
CREATE TYPE "CodeDeliveryStatus" AS ENUM ('pending', 'delivered', 'failed', 'manual');

-- CreateEnum
CREATE TYPE "CodeRefundStatus" AS ENUM ('none', 'refunding', 'refunded');

-- CreateTable
CREATE TABLE "code_platform_orders" (
    "id" UUID NOT NULL,
    "platform_id" UUID NOT NULL,
    "external_order_no" VARCHAR(120) NOT NULL,
    "buyer_id" VARCHAR(120),
    "buyer_name_masked" VARCHAR(120),
    "item_id" VARCHAR(120) NOT NULL,
    "sku_id" VARCHAR(120) NOT NULL DEFAULT '',
    "item_title" VARCHAR(255),
    "sku_name" VARCHAR(255),
    "service_id" UUID,
    "face_value" DECIMAL(18,4),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "platform_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "profit_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "order_status" VARCHAR(80) NOT NULL DEFAULT 'paid',
    "delivery_status" "CodeDeliveryStatus" NOT NULL DEFAULT 'pending',
    "refund_status" "CodeRefundStatus" NOT NULL DEFAULT 'none',
    "paid_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "code_platform_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "code_platform_orders_platform_id_external_order_no_key" ON "code_platform_orders"("platform_id", "external_order_no");

-- CreateIndex
CREATE INDEX "code_platform_orders_platform_id_idx" ON "code_platform_orders"("platform_id");

-- CreateIndex
CREATE INDEX "code_platform_orders_service_id_idx" ON "code_platform_orders"("service_id");

-- CreateIndex
CREATE INDEX "code_platform_orders_item_id_idx" ON "code_platform_orders"("item_id");

-- CreateIndex
CREATE INDEX "code_platform_orders_sku_id_idx" ON "code_platform_orders"("sku_id");

-- CreateIndex
CREATE INDEX "code_platform_orders_delivery_status_idx" ON "code_platform_orders"("delivery_status");

-- CreateIndex
CREATE INDEX "code_platform_orders_refund_status_idx" ON "code_platform_orders"("refund_status");

-- CreateIndex
CREATE INDEX "code_platform_orders_created_at_idx" ON "code_platform_orders"("created_at");

-- AddForeignKey
ALTER TABLE "code_platform_orders" ADD CONSTRAINT "code_platform_orders_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "source_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_platform_orders" ADD CONSTRAINT "code_platform_orders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "code_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_locked_order_id_fkey" FOREIGN KEY ("locked_order_id") REFERENCES "code_platform_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_delivered_order_id_fkey" FOREIGN KEY ("delivered_order_id") REFERENCES "code_platform_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CodeDeliveryMethod" AS ENUM ('eticket', 'dummy_send', 'message_card', 'manual');

-- CreateEnum
CREATE TYPE "CodeDeliveryLogStatus" AS ENUM ('success', 'failed', 'pending');

-- CreateTable
CREATE TABLE "code_delivery_logs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "platform_id" UUID NOT NULL,
    "external_order_no" VARCHAR(120) NOT NULL,
    "code_id" UUID NOT NULL,
    "face_value" DECIMAL(18,4) NOT NULL,
    "delivery_method" "CodeDeliveryMethod" NOT NULL,
    "delivery_content_snapshot" TEXT NOT NULL,
    "delivery_status" "CodeDeliveryLogStatus" NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "cost" DECIMAL(18,2) NOT NULL,
    "paid_amount" DECIMAL(18,2) NOT NULL,
    "profit" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_delivery_logs_order_id_idx" ON "code_delivery_logs"("order_id");

-- CreateIndex
CREATE INDEX "code_delivery_logs_platform_id_idx" ON "code_delivery_logs"("platform_id");

-- CreateIndex
CREATE INDEX "code_delivery_logs_code_id_idx" ON "code_delivery_logs"("code_id");

-- CreateIndex
CREATE INDEX "code_delivery_logs_external_order_no_idx" ON "code_delivery_logs"("external_order_no");

-- CreateIndex
CREATE INDEX "code_delivery_logs_delivery_status_idx" ON "code_delivery_logs"("delivery_status");

-- CreateIndex
CREATE INDEX "code_delivery_logs_created_at_idx" ON "code_delivery_logs"("created_at");

-- AddForeignKey
ALTER TABLE "code_delivery_logs" ADD CONSTRAINT "code_delivery_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "code_platform_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_delivery_logs" ADD CONSTRAINT "code_delivery_logs_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "source_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_delivery_logs" ADD CONSTRAINT "code_delivery_logs_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "redeem_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

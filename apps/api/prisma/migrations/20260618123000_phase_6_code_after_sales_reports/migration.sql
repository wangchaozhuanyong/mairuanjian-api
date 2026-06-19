-- CreateEnum
CREATE TYPE "CodeAfterSaleStatus" AS ENUM ('pending', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "CodeRefundRecordStatus" AS ENUM ('refunding', 'refunded', 'rejected');

-- CreateTable
CREATE TABLE "code_after_sales" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "original_code_id" UUID NOT NULL,
    "new_code_id" UUID,
    "reason" TEXT NOT NULL,
    "status" "CodeAfterSaleStatus" NOT NULL DEFAULT 'pending',
    "handled_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "code_after_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_refund_records" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "platform_id" UUID NOT NULL,
    "external_refund_no" VARCHAR(120) NOT NULL,
    "refund_amount" DECIMAL(18,2) NOT NULL,
    "status" "CodeRefundRecordStatus" NOT NULL DEFAULT 'refunding',
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "code_refund_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "code_after_sales_new_code_id_key" ON "code_after_sales"("new_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "code_after_sales_order_id_original_code_id_key" ON "code_after_sales"("order_id", "original_code_id");

-- CreateIndex
CREATE INDEX "code_after_sales_order_id_status_idx" ON "code_after_sales"("order_id", "status");

-- CreateIndex
CREATE INDEX "code_after_sales_original_code_id_idx" ON "code_after_sales"("original_code_id");

-- CreateIndex
CREATE INDEX "code_after_sales_new_code_id_idx" ON "code_after_sales"("new_code_id");

-- CreateIndex
CREATE INDEX "code_after_sales_handled_by_idx" ON "code_after_sales"("handled_by");

-- CreateIndex
CREATE INDEX "code_after_sales_created_at_idx" ON "code_after_sales"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "code_refund_records_platform_id_external_refund_no_key" ON "code_refund_records"("platform_id", "external_refund_no");

-- CreateIndex
CREATE INDEX "code_refund_records_order_id_idx" ON "code_refund_records"("order_id");

-- CreateIndex
CREATE INDEX "code_refund_records_platform_id_idx" ON "code_refund_records"("platform_id");

-- CreateIndex
CREATE INDEX "code_refund_records_status_idx" ON "code_refund_records"("status");

-- CreateIndex
CREATE INDEX "code_refund_records_created_at_idx" ON "code_refund_records"("created_at");

-- AddForeignKey
ALTER TABLE "code_after_sales" ADD CONSTRAINT "code_after_sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "code_platform_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_after_sales" ADD CONSTRAINT "code_after_sales_original_code_id_fkey" FOREIGN KEY ("original_code_id") REFERENCES "redeem_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_after_sales" ADD CONSTRAINT "code_after_sales_new_code_id_fkey" FOREIGN KEY ("new_code_id") REFERENCES "redeem_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_after_sales" ADD CONSTRAINT "code_after_sales_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_refund_records" ADD CONSTRAINT "code_refund_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "code_platform_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_refund_records" ADD CONSTRAINT "code_refund_records_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "source_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CodeServiceStatus" AS ENUM ('enabled', 'paused', 'disabled');

-- CreateEnum
CREATE TYPE "CodeDeliveryMode" AS ENUM ('auto', 'semi_auto', 'manual');

-- CreateEnum
CREATE TYPE "RedeemCodeStatus" AS ENUM (
    'unsold',
    'locked',
    'delivered',
    'delivery_failed',
    'after_sale',
    'reissued',
    'voided',
    'refunded'
);

-- CreateTable
CREATE TABLE "code_services" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "face_value" DECIMAL(18,4) NOT NULL,
    "default_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "default_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "delivery_mode" "CodeDeliveryMode" NOT NULL DEFAULT 'semi_auto',
    "exact_face_value_only" BOOLEAN NOT NULL DEFAULT true,
    "allow_combination" BOOLEAN NOT NULL DEFAULT false,
    "status" "CodeServiceStatus" NOT NULL DEFAULT 'enabled',
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "code_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redeem_code_batches" (
    "id" UUID NOT NULL,
    "batch_no" VARCHAR(80) NOT NULL,
    "service_id" UUID NOT NULL,
    "face_value" DECIMAL(18,4) NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "default_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "imported_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redeem_code_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redeem_codes" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "code_encrypted" TEXT NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "code_tail" VARCHAR(8) NOT NULL,
    "face_value" DECIMAL(18,4) NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL,
    "status" "RedeemCodeStatus" NOT NULL DEFAULT 'unsold',
    "locked_order_id" UUID,
    "delivered_order_id" UUID,
    "delivered_platform_id" UUID,
    "delivered_at" TIMESTAMPTZ(6),
    "expire_at" TIMESTAMPTZ(6),
    "remark" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "redeem_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_services_face_value_idx" ON "code_services"("face_value");

-- CreateIndex
CREATE INDEX "code_services_status_idx" ON "code_services"("status");

-- CreateIndex
CREATE INDEX "code_services_deleted_at_idx" ON "code_services"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "redeem_code_batches_batch_no_key" ON "redeem_code_batches"("batch_no");

-- CreateIndex
CREATE INDEX "redeem_code_batches_service_id_idx" ON "redeem_code_batches"("service_id");

-- CreateIndex
CREATE INDEX "redeem_code_batches_face_value_idx" ON "redeem_code_batches"("face_value");

-- CreateIndex
CREATE INDEX "redeem_code_batches_created_at_idx" ON "redeem_code_batches"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "redeem_codes_code_hash_key" ON "redeem_codes"("code_hash");

-- CreateIndex
CREATE INDEX "redeem_codes_service_id_status_idx" ON "redeem_codes"("service_id", "status");

-- CreateIndex
CREATE INDEX "redeem_codes_face_value_status_idx" ON "redeem_codes"("face_value", "status");

-- CreateIndex
CREATE INDEX "redeem_codes_batch_id_idx" ON "redeem_codes"("batch_id");

-- CreateIndex
CREATE INDEX "redeem_codes_delivered_order_id_idx" ON "redeem_codes"("delivered_order_id");

-- CreateIndex
CREATE INDEX "redeem_codes_expire_at_idx" ON "redeem_codes"("expire_at");

-- AddForeignKey
ALTER TABLE "code_services" ADD CONSTRAINT "code_services_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_services" ADD CONSTRAINT "code_services_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_code_batches" ADD CONSTRAINT "redeem_code_batches_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "code_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_code_batches" ADD CONSTRAINT "redeem_code_batches_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "code_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "redeem_code_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_delivered_platform_id_fkey" FOREIGN KEY ("delivered_platform_id") REFERENCES "source_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

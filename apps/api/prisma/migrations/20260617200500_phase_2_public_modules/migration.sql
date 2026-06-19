-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "SourcePlatformType" AS ENUM ('taobao', 'xianyu', 'wechat', 'manual', 'other');

-- CreateEnum
CREATE TYPE "SourcePlatformStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "MessageTemplateType" AS ENUM ('renewal', 'delivery', 'after_sale', 'notification', 'custom');

-- CreateEnum
CREATE TYPE "MessageTemplateChannel" AS ENUM ('internal', 'telegram', 'customer_service');

-- CreateEnum
CREATE TYPE "MessageTemplateStatus" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "source_platforms" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "type" "SourcePlatformType" NOT NULL DEFAULT 'other',
    "fee_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "fee_fixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "SourcePlatformStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "source_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "contact_name" VARCHAR(120),
    "phone" VARCHAR(50),
    "phone_tail" VARCHAR(8),
    "wechat" VARCHAR(120),
    "source_platform_id" UUID,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "remark" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'active',
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "MessageTemplateType" NOT NULL DEFAULT 'custom',
    "channel" "MessageTemplateChannel" NOT NULL DEFAULT 'internal',
    "content" TEXT NOT NULL,
    "variables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "MessageTemplateStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_platforms_code_key" ON "source_platforms"("code");

-- CreateIndex
CREATE INDEX "source_platforms_type_idx" ON "source_platforms"("type");

-- CreateIndex
CREATE INDEX "source_platforms_status_idx" ON "source_platforms"("status");

-- CreateIndex
CREATE INDEX "source_platforms_deleted_at_idx" ON "source_platforms"("deleted_at");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_phone_tail_idx" ON "customers"("phone_tail");

-- CreateIndex
CREATE INDEX "customers_source_platform_id_idx" ON "customers"("source_platform_id");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- CreateIndex
CREATE INDEX "message_templates_type_idx" ON "message_templates"("type");

-- CreateIndex
CREATE INDEX "message_templates_channel_idx" ON "message_templates"("channel");

-- CreateIndex
CREATE INDEX "message_templates_status_idx" ON "message_templates"("status");

-- CreateIndex
CREATE INDEX "message_templates_deleted_at_idx" ON "message_templates"("deleted_at");

-- AddForeignKey
ALTER TABLE "source_platforms" ADD CONSTRAINT "source_platforms_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_platforms" ADD CONSTRAINT "source_platforms_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_source_platform_id_fkey" FOREIGN KEY ("source_platform_id") REFERENCES "source_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('telegram', 'in_app');

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('info', 'warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "TelegramTestStatus" AS ENUM ('not_tested', 'success', 'failed');

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "type" "NotificationChannelType" NOT NULL DEFAULT 'in_app',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "level" "NotificationLevel" NOT NULL DEFAULT 'info',
    "config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_configs" (
    "id" UUID NOT NULL,
    "notification_name" VARCHAR(120) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "bot_token_encrypted" TEXT,
    "bot_token_tail" VARCHAR(12),
    "chat_id" VARCHAR(160) NOT NULL,
    "notification_level" "NotificationLevel" NOT NULL DEFAULT 'warning',
    "silent_start_time" VARCHAR(10),
    "silent_end_time" VARCHAR(10),
    "retry_count" INTEGER NOT NULL DEFAULT 3,
    "last_test_status" "TelegramTestStatus" NOT NULL DEFAULT 'not_tested',
    "last_test_error" TEXT,
    "last_test_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "telegram_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "event_code" VARCHAR(120) NOT NULL,
    "module" VARCHAR(80) NOT NULL,
    "level" "NotificationLevel" NOT NULL DEFAULT 'info',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipients" JSONB,
    "trigger_condition" JSONB,
    "rate_limit" JSONB,
    "last_triggered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "event_code" VARCHAR(120) NOT NULL,
    "rule_id" UUID,
    "channel" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "rule_id" UUID,
    "event_code" VARCHAR(120) NOT NULL,
    "module" VARCHAR(80) NOT NULL,
    "channel" VARCHAR(40) NOT NULL,
    "recipient" VARCHAR(255),
    "recipient_user_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "content_digest" TEXT NOT NULL,
    "payload" JSONB,
    "status" "NotificationLogStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "read_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_code_key" ON "notification_channels"("code");

-- CreateIndex
CREATE INDEX "notification_channels_type_enabled_idx" ON "notification_channels"("type", "enabled");

-- CreateIndex
CREATE INDEX "notification_channels_deleted_at_idx" ON "notification_channels"("deleted_at");

-- CreateIndex
CREATE INDEX "telegram_configs_enabled_idx" ON "telegram_configs"("enabled");

-- CreateIndex
CREATE INDEX "telegram_configs_notification_level_idx" ON "telegram_configs"("notification_level");

-- CreateIndex
CREATE INDEX "telegram_configs_deleted_at_idx" ON "telegram_configs"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rules_event_code_key" ON "notification_rules"("event_code");

-- CreateIndex
CREATE INDEX "notification_rules_module_enabled_idx" ON "notification_rules"("module", "enabled");

-- CreateIndex
CREATE INDEX "notification_rules_level_idx" ON "notification_rules"("level");

-- CreateIndex
CREATE INDEX "notification_rules_deleted_at_idx" ON "notification_rules"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_event_code_channel_key" ON "notification_templates"("event_code", "channel");

-- CreateIndex
CREATE INDEX "notification_templates_rule_id_idx" ON "notification_templates"("rule_id");

-- CreateIndex
CREATE INDEX "notification_templates_enabled_idx" ON "notification_templates"("enabled");

-- CreateIndex
CREATE INDEX "notification_templates_deleted_at_idx" ON "notification_templates"("deleted_at");

-- CreateIndex
CREATE INDEX "notification_logs_event_code_idx" ON "notification_logs"("event_code");

-- CreateIndex
CREATE INDEX "notification_logs_module_status_idx" ON "notification_logs"("module", "status");

-- CreateIndex
CREATE INDEX "notification_logs_channel_status_idx" ON "notification_logs"("channel", "status");

-- CreateIndex
CREATE INDEX "notification_logs_recipient_user_id_read_at_idx" ON "notification_logs"("recipient_user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at");

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "notification_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "notification_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_read_by_user_id_fkey" FOREIGN KEY ("read_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

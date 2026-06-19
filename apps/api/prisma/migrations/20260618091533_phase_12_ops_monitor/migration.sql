-- CreateEnum
CREATE TYPE "OpsHealthStatus" AS ENUM ('normal', 'warning', 'error', 'critical', 'unknown');

-- CreateEnum
CREATE TYPE "CronJobLogStatus" AS ENUM ('running', 'success', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "PlatformSyncLogStatus" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "ErrorLogLevel" AS ENUM ('info', 'warn', 'error', 'fatal');

-- CreateTable
CREATE TABLE "system_health_snapshots" (
    "id" UUID NOT NULL,
    "api_status" "OpsHealthStatus" NOT NULL,
    "db_status" "OpsHealthStatus" NOT NULL,
    "redis_status" "OpsHealthStatus" NOT NULL,
    "storage_status" "OpsHealthStatus" NOT NULL,
    "queue_status" "OpsHealthStatus" NOT NULL,
    "worker_status" "OpsHealthStatus" NOT NULL,
    "disk_usage" DECIMAL(18,4),
    "metrics" JSONB DEFAULT '{}',
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_status_logs" (
    "id" UUID NOT NULL,
    "queue_name" VARCHAR(120) NOT NULL,
    "waiting_count" INTEGER NOT NULL DEFAULT 0,
    "active_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "delayed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "OpsHealthStatus" NOT NULL DEFAULT 'normal',
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_job_logs" (
    "id" UUID NOT NULL,
    "job_name" VARCHAR(160) NOT NULL,
    "status" "CronJobLogStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_sync_logs" (
    "id" UUID NOT NULL,
    "platform" VARCHAR(80) NOT NULL,
    "sync_type" VARCHAR(80) NOT NULL,
    "status" "PlatformSyncLogStatus" NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "error_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" UUID NOT NULL,
    "level" "ErrorLogLevel" NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_health_snapshots_api_status_idx" ON "system_health_snapshots"("api_status");

-- CreateIndex
CREATE INDEX "system_health_snapshots_db_status_idx" ON "system_health_snapshots"("db_status");

-- CreateIndex
CREATE INDEX "system_health_snapshots_redis_status_idx" ON "system_health_snapshots"("redis_status");

-- CreateIndex
CREATE INDEX "system_health_snapshots_queue_status_idx" ON "system_health_snapshots"("queue_status");

-- CreateIndex
CREATE INDEX "system_health_snapshots_worker_status_idx" ON "system_health_snapshots"("worker_status");

-- CreateIndex
CREATE INDEX "system_health_snapshots_checked_at_idx" ON "system_health_snapshots"("checked_at");

-- CreateIndex
CREATE INDEX "queue_status_logs_queue_name_idx" ON "queue_status_logs"("queue_name");

-- CreateIndex
CREATE INDEX "queue_status_logs_status_idx" ON "queue_status_logs"("status");

-- CreateIndex
CREATE INDEX "queue_status_logs_checked_at_idx" ON "queue_status_logs"("checked_at");

-- CreateIndex
CREATE INDEX "cron_job_logs_job_name_idx" ON "cron_job_logs"("job_name");

-- CreateIndex
CREATE INDEX "cron_job_logs_status_idx" ON "cron_job_logs"("status");

-- CreateIndex
CREATE INDEX "cron_job_logs_started_at_idx" ON "cron_job_logs"("started_at");

-- CreateIndex
CREATE INDEX "cron_job_logs_finished_at_idx" ON "cron_job_logs"("finished_at");

-- CreateIndex
CREATE INDEX "cron_job_logs_created_at_idx" ON "cron_job_logs"("created_at");

-- CreateIndex
CREATE INDEX "platform_sync_logs_platform_idx" ON "platform_sync_logs"("platform");

-- CreateIndex
CREATE INDEX "platform_sync_logs_sync_type_idx" ON "platform_sync_logs"("sync_type");

-- CreateIndex
CREATE INDEX "platform_sync_logs_status_idx" ON "platform_sync_logs"("status");

-- CreateIndex
CREATE INDEX "platform_sync_logs_started_at_idx" ON "platform_sync_logs"("started_at");

-- CreateIndex
CREATE INDEX "platform_sync_logs_finished_at_idx" ON "platform_sync_logs"("finished_at");

-- CreateIndex
CREATE INDEX "platform_sync_logs_created_at_idx" ON "platform_sync_logs"("created_at");

-- CreateIndex
CREATE INDEX "error_logs_level_idx" ON "error_logs"("level");

-- CreateIndex
CREATE INDEX "error_logs_module_idx" ON "error_logs"("module");

-- CreateIndex
CREATE INDEX "error_logs_occurred_at_idx" ON "error_logs"("occurred_at");

-- CreateEnum
CREATE TYPE "DataJobStatus" AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "BackupJobType" AS ENUM ('database', 'files', 'config');

-- CreateEnum
CREATE TYPE "DataDictionaryStatus" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "backup_jobs" (
    "id" UUID NOT NULL,
    "job_type" "BackupJobType" NOT NULL,
    "status" "DataJobStatus" NOT NULL DEFAULT 'pending',
    "storage_path" VARCHAR(500),
    "file_size" BIGINT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "remark" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_jobs" (
    "id" UUID NOT NULL,
    "backup_job_id" UUID,
    "status" "DataJobStatus" NOT NULL DEFAULT 'pending',
    "restore_scope" VARCHAR(120) NOT NULL,
    "approval_note" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" UUID NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "file_path" VARCHAR(500),
    "status" "DataJobStatus" NOT NULL DEFAULT 'pending',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "error_report" VARCHAR(500),
    "remark" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_jobs" (
    "id" UUID NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "export_scope" JSONB,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contains_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "status" "DataJobStatus" NOT NULL DEFAULT 'pending',
    "file_path" VARCHAR(500),
    "download_expires_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recycle_bin_records" (
    "id" UUID NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "object_type" VARCHAR(120) NOT NULL,
    "object_id" UUID,
    "object_label" VARCHAR(255) NOT NULL,
    "snapshot_data" JSONB,
    "deleted_by" UUID,
    "deleted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restored_by" UUID,
    "restored_at" TIMESTAMPTZ(6),

    CONSTRAINT "recycle_bin_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameters" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "group" VARCHAR(80) NOT NULL DEFAULT 'default',
    "remark" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_dictionaries" (
    "id" UUID NOT NULL,
    "group" VARCHAR(80) NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "value" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "DataDictionaryStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_dictionaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_cleanup_jobs" (
    "id" UUID NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "cleanup_scope" JSONB,
    "status" "DataJobStatus" NOT NULL DEFAULT 'pending',
    "affected_count" INTEGER NOT NULL DEFAULT 0,
    "approval_note" TEXT,
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "data_cleanup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_merge_jobs" (
    "id" UUID NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "match_rule" JSONB,
    "primary_object_id" UUID,
    "duplicate_object_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "DataJobStatus" NOT NULL DEFAULT 'pending',
    "affected_count" INTEGER NOT NULL DEFAULT 0,
    "approval_note" TEXT,
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "duplicate_merge_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_jobs_job_type_idx" ON "backup_jobs"("job_type");

-- CreateIndex
CREATE INDEX "backup_jobs_status_idx" ON "backup_jobs"("status");

-- CreateIndex
CREATE INDEX "backup_jobs_created_by_idx" ON "backup_jobs"("created_by");

-- CreateIndex
CREATE INDEX "backup_jobs_created_at_idx" ON "backup_jobs"("created_at");

-- CreateIndex
CREATE INDEX "restore_jobs_backup_job_id_idx" ON "restore_jobs"("backup_job_id");

-- CreateIndex
CREATE INDEX "restore_jobs_status_idx" ON "restore_jobs"("status");

-- CreateIndex
CREATE INDEX "restore_jobs_created_by_idx" ON "restore_jobs"("created_by");

-- CreateIndex
CREATE INDEX "restore_jobs_created_at_idx" ON "restore_jobs"("created_at");

-- CreateIndex
CREATE INDEX "data_import_jobs_module_idx" ON "data_import_jobs"("module");

-- CreateIndex
CREATE INDEX "data_import_jobs_status_idx" ON "data_import_jobs"("status");

-- CreateIndex
CREATE INDEX "data_import_jobs_created_by_idx" ON "data_import_jobs"("created_by");

-- CreateIndex
CREATE INDEX "data_import_jobs_created_at_idx" ON "data_import_jobs"("created_at");

-- CreateIndex
CREATE INDEX "data_export_jobs_module_idx" ON "data_export_jobs"("module");

-- CreateIndex
CREATE INDEX "data_export_jobs_status_idx" ON "data_export_jobs"("status");

-- CreateIndex
CREATE INDEX "data_export_jobs_contains_sensitive_idx" ON "data_export_jobs"("contains_sensitive");

-- CreateIndex
CREATE INDEX "data_export_jobs_created_by_idx" ON "data_export_jobs"("created_by");

-- CreateIndex
CREATE INDEX "data_export_jobs_created_at_idx" ON "data_export_jobs"("created_at");

-- CreateIndex
CREATE INDEX "recycle_bin_records_module_idx" ON "recycle_bin_records"("module");

-- CreateIndex
CREATE INDEX "recycle_bin_records_object_type_object_id_idx" ON "recycle_bin_records"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "recycle_bin_records_deleted_by_idx" ON "recycle_bin_records"("deleted_by");

-- CreateIndex
CREATE INDEX "recycle_bin_records_restored_at_idx" ON "recycle_bin_records"("restored_at");

-- CreateIndex
CREATE INDEX "recycle_bin_records_deleted_at_idx" ON "recycle_bin_records"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_parameters_key_key" ON "system_parameters"("key");

-- CreateIndex
CREATE INDEX "system_parameters_group_idx" ON "system_parameters"("group");

-- CreateIndex
CREATE INDEX "system_parameters_updated_by_idx" ON "system_parameters"("updated_by");

-- CreateIndex
CREATE INDEX "data_dictionaries_group_idx" ON "data_dictionaries"("group");

-- CreateIndex
CREATE INDEX "data_dictionaries_status_idx" ON "data_dictionaries"("status");

-- CreateIndex
CREATE INDEX "data_dictionaries_sort_order_idx" ON "data_dictionaries"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "data_dictionaries_group_code_key" ON "data_dictionaries"("group", "code");

-- CreateIndex
CREATE INDEX "data_cleanup_jobs_module_idx" ON "data_cleanup_jobs"("module");

-- CreateIndex
CREATE INDEX "data_cleanup_jobs_status_idx" ON "data_cleanup_jobs"("status");

-- CreateIndex
CREATE INDEX "data_cleanup_jobs_created_by_idx" ON "data_cleanup_jobs"("created_by");

-- CreateIndex
CREATE INDEX "data_cleanup_jobs_created_at_idx" ON "data_cleanup_jobs"("created_at");

-- CreateIndex
CREATE INDEX "duplicate_merge_jobs_module_idx" ON "duplicate_merge_jobs"("module");

-- CreateIndex
CREATE INDEX "duplicate_merge_jobs_status_idx" ON "duplicate_merge_jobs"("status");

-- CreateIndex
CREATE INDEX "duplicate_merge_jobs_created_by_idx" ON "duplicate_merge_jobs"("created_by");

-- CreateIndex
CREATE INDEX "duplicate_merge_jobs_created_at_idx" ON "duplicate_merge_jobs"("created_at");

-- AddForeignKey
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_backup_job_id_fkey" FOREIGN KEY ("backup_job_id") REFERENCES "backup_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycle_bin_records" ADD CONSTRAINT "recycle_bin_records_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycle_bin_records" ADD CONSTRAINT "recycle_bin_records_restored_by_fkey" FOREIGN KEY ("restored_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_parameters" ADD CONSTRAINT "system_parameters_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_dictionaries" ADD CONSTRAINT "data_dictionaries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_dictionaries" ADD CONSTRAINT "data_dictionaries_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_cleanup_jobs" ADD CONSTRAINT "data_cleanup_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_merge_jobs" ADD CONSTRAINT "duplicate_merge_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

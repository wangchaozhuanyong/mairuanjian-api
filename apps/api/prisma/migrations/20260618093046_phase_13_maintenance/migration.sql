-- CreateEnum
CREATE TYPE "AppAnnouncementLevel" AS ENUM ('info', 'warning', 'error');

-- CreateEnum
CREATE TYPE "AppVersionStatus" AS ENUM ('draft', 'released', 'deprecated');

-- CreateTable
CREATE TABLE "app_announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL,
    "level" "AppAnnouncementLevel" NOT NULL DEFAULT 'info',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "app_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_windows" (
    "id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "allowed_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB DEFAULT '{}',
    "remark" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_versions" (
    "id" UUID NOT NULL,
    "version" VARCHAR(80) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "status" "AppVersionStatus" NOT NULL DEFAULT 'draft',
    "release_notes" TEXT NOT NULL,
    "impact_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "released_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_announcements_level_idx" ON "app_announcements"("level");

-- CreateIndex
CREATE INDEX "app_announcements_enabled_idx" ON "app_announcements"("enabled");

-- CreateIndex
CREATE INDEX "app_announcements_start_at_idx" ON "app_announcements"("start_at");

-- CreateIndex
CREATE INDEX "app_announcements_end_at_idx" ON "app_announcements"("end_at");

-- CreateIndex
CREATE INDEX "app_announcements_created_by_idx" ON "app_announcements"("created_by");

-- CreateIndex
CREATE INDEX "app_announcements_deleted_at_idx" ON "app_announcements"("deleted_at");

-- CreateIndex
CREATE INDEX "maintenance_windows_enabled_idx" ON "maintenance_windows"("enabled");

-- CreateIndex
CREATE INDEX "maintenance_windows_start_at_idx" ON "maintenance_windows"("start_at");

-- CreateIndex
CREATE INDEX "maintenance_windows_end_at_idx" ON "maintenance_windows"("end_at");

-- CreateIndex
CREATE INDEX "maintenance_windows_created_by_idx" ON "maintenance_windows"("created_by");

-- CreateIndex
CREATE INDEX "maintenance_windows_deleted_at_idx" ON "maintenance_windows"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "feature_flags"("enabled");

-- CreateIndex
CREATE INDEX "feature_flags_updated_by_idx" ON "feature_flags"("updated_by");

-- CreateIndex
CREATE INDEX "feature_flags_deleted_at_idx" ON "feature_flags"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_version_key" ON "app_versions"("version");

-- CreateIndex
CREATE INDEX "app_versions_status_idx" ON "app_versions"("status");

-- CreateIndex
CREATE INDEX "app_versions_released_at_idx" ON "app_versions"("released_at");

-- CreateIndex
CREATE INDEX "app_versions_created_by_idx" ON "app_versions"("created_by");

-- AddForeignKey
ALTER TABLE "app_announcements" ADD CONSTRAINT "app_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_announcements" ADD CONSTRAINT "app_announcements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_windows" ADD CONSTRAINT "maintenance_windows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_windows" ADD CONSTRAINT "maintenance_windows_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

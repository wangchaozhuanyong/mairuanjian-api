-- CreateEnum
CREATE TYPE "LoginLogStatus" AS ENUM ('success', 'failed', 'blocked');

-- CreateEnum
CREATE TYPE "IpWhitelistScope" AS ENUM ('admin', 'api', 'automation');

-- CreateEnum
CREATE TYPE "SensitiveAccessApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateTable
CREATE TABLE "login_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "username" VARCHAR(100) NOT NULL,
    "status" "LoginLogStatus" NOT NULL,
    "failure_reason" TEXT,
    "ip" VARCHAR(100),
    "user_agent" TEXT,
    "location" VARCHAR(120),
    "abnormal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "ip" VARCHAR(100),
    "user_agent" TEXT,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "remark" TEXT,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_whitelists" (
    "id" UUID NOT NULL,
    "ip_or_cidr" VARCHAR(100) NOT NULL,
    "scope" "IpWhitelistScope" NOT NULL DEFAULT 'admin',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ip_whitelists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_access_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "module" VARCHAR(100) NOT NULL,
    "field_name" VARCHAR(120) NOT NULL,
    "object_type" VARCHAR(120) NOT NULL,
    "object_id" UUID,
    "access_reason" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "ip" VARCHAR(100),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_access_approvals" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "approver_id" UUID,
    "module" VARCHAR(100) NOT NULL,
    "field_name" VARCHAR(120) NOT NULL,
    "object_type" VARCHAR(120) NOT NULL,
    "object_id" UUID,
    "reason" TEXT NOT NULL,
    "status" "SensitiveAccessApprovalStatus" NOT NULL DEFAULT 'pending',
    "decision_note" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sensitive_access_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_logs_user_id_idx" ON "login_logs"("user_id");

-- CreateIndex
CREATE INDEX "login_logs_username_idx" ON "login_logs"("username");

-- CreateIndex
CREATE INDEX "login_logs_ip_idx" ON "login_logs"("ip");

-- CreateIndex
CREATE INDEX "login_logs_abnormal_idx" ON "login_logs"("abnormal");

-- CreateIndex
CREATE INDEX "login_logs_created_at_idx" ON "login_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "active_sessions_token_hash_key" ON "active_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "active_sessions_user_id_idx" ON "active_sessions"("user_id");

-- CreateIndex
CREATE INDEX "active_sessions_expires_at_idx" ON "active_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "active_sessions_revoked_at_idx" ON "active_sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "security_settings_key_key" ON "security_settings"("key");

-- CreateIndex
CREATE INDEX "security_settings_updated_by_user_id_idx" ON "security_settings"("updated_by_user_id");

-- CreateIndex
CREATE INDEX "ip_whitelists_scope_enabled_idx" ON "ip_whitelists"("scope", "enabled");

-- CreateIndex
CREATE INDEX "ip_whitelists_created_by_user_id_idx" ON "ip_whitelists"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ip_whitelists_ip_or_cidr_scope_key" ON "ip_whitelists"("ip_or_cidr", "scope");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_user_id_idx" ON "sensitive_access_logs"("user_id");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_module_field_name_idx" ON "sensitive_access_logs"("module", "field_name");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_object_type_object_id_idx" ON "sensitive_access_logs"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_approved_idx" ON "sensitive_access_logs"("approved");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_created_at_idx" ON "sensitive_access_logs"("created_at");

-- CreateIndex
CREATE INDEX "sensitive_access_approvals_requester_id_idx" ON "sensitive_access_approvals"("requester_id");

-- CreateIndex
CREATE INDEX "sensitive_access_approvals_approver_id_idx" ON "sensitive_access_approvals"("approver_id");

-- CreateIndex
CREATE INDEX "sensitive_access_approvals_module_field_name_idx" ON "sensitive_access_approvals"("module", "field_name");

-- CreateIndex
CREATE INDEX "sensitive_access_approvals_status_idx" ON "sensitive_access_approvals"("status");

-- CreateIndex
CREATE INDEX "sensitive_access_approvals_expires_at_idx" ON "sensitive_access_approvals"("expires_at");

-- CreateIndex
CREATE INDEX "sensitive_access_approvals_created_at_idx" ON "sensitive_access_approvals"("created_at");

-- AddForeignKey
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_settings" ADD CONSTRAINT "security_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_whitelists" ADD CONSTRAINT "ip_whitelists_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_access_approvals" ADD CONSTRAINT "sensitive_access_approvals_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_access_approvals" ADD CONSTRAINT "sensitive_access_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

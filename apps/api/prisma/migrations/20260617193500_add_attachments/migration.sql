-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_created_by_user_id_idx" ON "attachments"("created_by_user_id");

-- CreateIndex
CREATE INDEX "attachments_created_at_idx" ON "attachments"("created_at");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

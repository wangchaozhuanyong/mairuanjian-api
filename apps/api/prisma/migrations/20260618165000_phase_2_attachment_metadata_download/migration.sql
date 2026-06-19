ALTER TABLE "attachments"
  ADD COLUMN "business_module" VARCHAR(80),
  ADD COLUMN "object_type" VARCHAR(120),
  ADD COLUMN "object_id" UUID,
  ADD COLUMN "purpose" VARCHAR(120),
  ADD COLUMN "remark" TEXT;

CREATE INDEX "attachments_business_module_object_type_idx" ON "attachments"("business_module", "object_type");
CREATE INDEX "attachments_object_id_idx" ON "attachments"("object_id");
CREATE INDEX "attachments_purpose_idx" ON "attachments"("purpose");

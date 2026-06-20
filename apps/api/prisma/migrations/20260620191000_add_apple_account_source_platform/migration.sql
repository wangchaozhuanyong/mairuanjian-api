ALTER TABLE "apple_accounts" ADD COLUMN "source_platform_id" UUID;

CREATE INDEX "apple_accounts_source_platform_id_idx" ON "apple_accounts"("source_platform_id");

ALTER TABLE "apple_accounts"
  ADD CONSTRAINT "apple_accounts_source_platform_id_fkey"
  FOREIGN KEY ("source_platform_id")
  REFERENCES "source_platforms"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

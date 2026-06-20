ALTER TABLE "source_platforms"
  DROP COLUMN IF EXISTS "code",
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS "sync_enabled",
  DROP COLUMN IF EXISTS "delivery_enabled";

DROP TYPE IF EXISTS "SourcePlatformType";

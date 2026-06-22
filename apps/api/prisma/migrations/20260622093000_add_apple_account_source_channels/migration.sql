CREATE TYPE "AppleAccountSourceChannelStatus" AS ENUM ('active', 'disabled');

CREATE TABLE "apple_account_source_channels" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "AppleAccountSourceChannelStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "apple_account_source_channels_pkey" PRIMARY KEY ("id")
);

INSERT INTO "apple_account_source_channels" (
    "id",
    "name",
    "status",
    "remark",
    "created_by_user_id",
    "updated_by_user_id",
    "created_at",
    "updated_at"
)
SELECT DISTINCT
    "source_platforms"."id",
    "source_platforms"."name",
    "source_platforms"."status"::TEXT::"AppleAccountSourceChannelStatus",
    "source_platforms"."remark",
    "source_platforms"."created_by_user_id",
    "source_platforms"."updated_by_user_id",
    "source_platforms"."created_at",
    "source_platforms"."updated_at"
FROM "source_platforms"
INNER JOIN "apple_accounts"
    ON "apple_accounts"."source_platform_id" = "source_platforms"."id"
WHERE "apple_accounts"."source_platform_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "apple_accounts"
    DROP CONSTRAINT IF EXISTS "apple_accounts_source_platform_id_fkey";

ALTER TABLE "apple_accounts"
    RENAME COLUMN "source_platform_id" TO "source_channel_id";

ALTER INDEX IF EXISTS "apple_accounts_source_platform_id_idx"
    RENAME TO "apple_accounts_source_channel_id_idx";

CREATE INDEX "apple_account_source_channels_status_idx"
    ON "apple_account_source_channels"("status");

CREATE INDEX "apple_account_source_channels_deleted_at_idx"
    ON "apple_account_source_channels"("deleted_at");

ALTER TABLE "apple_account_source_channels"
    ADD CONSTRAINT "apple_account_source_channels_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "apple_account_source_channels"
    ADD CONSTRAINT "apple_account_source_channels_updated_by_user_id_fkey"
    FOREIGN KEY ("updated_by_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "apple_accounts"
    ADD CONSTRAINT "apple_accounts_source_channel_id_fkey"
    FOREIGN KEY ("source_channel_id")
    REFERENCES "apple_account_source_channels"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

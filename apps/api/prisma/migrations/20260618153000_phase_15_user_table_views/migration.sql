CREATE TABLE "user_table_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "table_key" varchar(120) NOT NULL,
  "view_name" varchar(120) NOT NULL,
  "filters" jsonb NOT NULL DEFAULT '{}',
  "sort_config" jsonb NOT NULL DEFAULT '{}',
  "columns" jsonb NOT NULL DEFAULT '[]',
  "density" varchar(20) NOT NULL DEFAULT 'default',
  "page_size" integer NOT NULL DEFAULT 20,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "user_table_views_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_table_views_user_id_table_key_view_name_key"
  ON "user_table_views"("user_id", "table_key", "view_name");

CREATE UNIQUE INDEX "user_table_views_one_default_per_table_key"
  ON "user_table_views"("user_id", "table_key")
  WHERE "is_default" = true;

CREATE INDEX "user_table_views_user_id_table_key_idx"
  ON "user_table_views"("user_id", "table_key");

CREATE INDEX "user_table_views_user_id_table_key_is_default_idx"
  ON "user_table_views"("user_id", "table_key", "is_default");

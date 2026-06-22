CREATE TYPE "AppleAccountOwnershipType" AS ENUM ('consigned', 'sold');

ALTER TABLE "apple_accounts"
  ADD COLUMN "ownership_type" "AppleAccountOwnershipType" NOT NULL DEFAULT 'consigned',
  ADD COLUMN "purchase_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "sale_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "sold_at" TIMESTAMPTZ(6),
  ADD COLUMN "sold_order_id" UUID,
  ADD COLUMN "sold_customer_id" UUID;

ALTER TABLE "apple_orders"
  ADD COLUMN "apple_account_ownership_type" "AppleAccountOwnershipType" NOT NULL DEFAULT 'consigned',
  ADD COLUMN "apple_account_purchase_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "apple_account_sale_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "apple_account_sale_profit" DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE "service_activations"
  ADD COLUMN "apple_account_ownership_type" "AppleAccountOwnershipType" NOT NULL DEFAULT 'consigned',
  ADD COLUMN "apple_account_purchase_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "apple_account_sale_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "apple_account_sale_profit" DECIMAL(18,4) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "apple_accounts_sold_order_id_key"
  ON "apple_accounts"("sold_order_id");
CREATE INDEX "apple_accounts_ownership_type_idx"
  ON "apple_accounts"("ownership_type");
CREATE INDEX "apple_accounts_sold_customer_id_idx"
  ON "apple_accounts"("sold_customer_id");

ALTER TABLE "apple_accounts"
  ADD CONSTRAINT "apple_accounts_sold_order_id_fkey"
  FOREIGN KEY ("sold_order_id") REFERENCES "apple_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "apple_accounts"
  ADD CONSTRAINT "apple_accounts_sold_customer_id_fkey"
  FOREIGN KEY ("sold_customer_id") REFERENCES "customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

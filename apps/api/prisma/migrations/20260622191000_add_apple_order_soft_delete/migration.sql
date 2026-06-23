ALTER TABLE "apple_orders"
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE INDEX "apple_orders_deleted_at_idx" ON "apple_orders"("deleted_at");

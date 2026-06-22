ALTER TABLE "apple_orders"
  ADD COLUMN "paid_currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
  ADD COLUMN "paid_exchange_rate_to_rmb" DECIMAL(18,8) NOT NULL DEFAULT 1,
  ADD COLUMN "paid_amount_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "platform_fee_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "refund_loss_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0;

UPDATE "apple_orders"
SET
  "paid_currency" = 'CNY',
  "paid_exchange_rate_to_rmb" = 1,
  "paid_amount_rmb" = "paid_amount",
  "platform_fee_rmb" = "platform_fee",
  "refund_loss_rmb" = "refund_loss";

ALTER TABLE "service_activations"
  ADD COLUMN "paid_currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
  ADD COLUMN "paid_exchange_rate_to_rmb" DECIMAL(18,8) NOT NULL DEFAULT 1,
  ADD COLUMN "paid_amount_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "platform_fee_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "refund_loss_rmb" DECIMAL(18,4) NOT NULL DEFAULT 0;

UPDATE "service_activations"
SET
  "paid_currency" = 'CNY',
  "paid_exchange_rate_to_rmb" = 1,
  "paid_amount_rmb" = "paid_amount",
  "platform_fee_rmb" = "platform_fee",
  "refund_loss_rmb" = "refund_loss";

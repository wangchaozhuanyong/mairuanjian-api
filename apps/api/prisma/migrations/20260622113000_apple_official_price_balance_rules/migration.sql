-- Split collected official web price from the Apple-balance opening price.
CREATE TYPE "AppleBalancePriceRuleType" AS ENUM ('inherit', 'percent', 'fixed_add', 'manual');

ALTER TABLE "apple_services"
  ADD COLUMN "official_base_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "apple_balance_price_rule_type" "AppleBalancePriceRuleType" NOT NULL DEFAULT 'inherit',
  ADD COLUMN "apple_balance_price_rule_value" DECIMAL(18,4);

UPDATE "apple_services"
SET
  "official_base_price" = "official_cost_value",
  "apple_balance_price_rule_type" = 'manual',
  "apple_balance_price_rule_value" = NULL;

ALTER TABLE "apple_official_price_sources"
  ADD COLUMN "provider" VARCHAR(40) NOT NULL DEFAULT 'manual',
  ADD COLUMN "price_source_type" VARCHAR(40) NOT NULL DEFAULT 'official_web';

ALTER TABLE "apple_official_price_snapshots"
  ADD COLUMN "provider" VARCHAR(40) NOT NULL DEFAULT 'manual',
  ADD COLUMN "plan_code" VARCHAR(120),
  ADD COLUMN "apple_balance_price" DECIMAL(18,4);

CREATE INDEX "apple_services_apple_balance_price_rule_type_idx"
  ON "apple_services"("apple_balance_price_rule_type");
CREATE INDEX "apple_official_price_sources_provider_idx"
  ON "apple_official_price_sources"("provider");
CREATE INDEX "apple_official_price_snapshots_provider_idx"
  ON "apple_official_price_snapshots"("provider");

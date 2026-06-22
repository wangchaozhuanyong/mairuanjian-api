import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppleOfficialPricesService } from './apple-official-prices.service';

const DEFAULT_OFFICIAL_PRICE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class AppleOfficialPricePollingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppleOfficialPricePollingWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly officialPricesService: AppleOfficialPricesService) {}

  onModuleInit() {
    if (process.env.APPLE_OFFICIAL_PRICE_POLL_ENABLED !== 'true') return;

    const intervalMs = this.getIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    if (process.env.APPLE_OFFICIAL_PRICE_POLL_RUN_ON_STARTUP === 'true') {
      void this.runOnce();
    }

    this.logger.log(`Apple official price polling enabled, interval=${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.officialPricesService.runDueSourceChecks('worker', {
        bootstrapProviders: process.env.APPLE_OFFICIAL_PRICE_POLL_BOOTSTRAP_PROVIDERS === 'true'
      });
      this.logger.log(
        `Apple official price polling finished, bootstrapped=${result.bootstrappedSourceCount}, scanned=${result.scannedCount}, due=${result.dueCount}`
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Apple official price polling failed'
      );
    } finally {
      this.running = false;
    }
  }

  private getIntervalMs() {
    const value = Number(process.env.APPLE_OFFICIAL_PRICE_POLL_INTERVAL_MS);
    if (!Number.isFinite(value) || value < 60_000) {
      return DEFAULT_OFFICIAL_PRICE_POLL_INTERVAL_MS;
    }
    return Math.floor(value);
  }
}

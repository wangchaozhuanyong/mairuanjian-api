import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PlatformDeliveryService } from './platform-delivery.service';

const DEFAULT_PLATFORM_POLL_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class PlatformPollingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformPollingWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly platformDeliveryService: PlatformDeliveryService) {}

  onModuleInit() {
    if (process.env.PLATFORM_POLL_ENABLED !== 'true') return;

    const intervalMs = this.getIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    if (process.env.PLATFORM_POLL_RUN_ON_STARTUP === 'true') {
      void this.runOnce();
    }

    this.logger.log(`Platform polling worker enabled, interval=${intervalMs}ms`);
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
      await this.platformDeliveryService.pollAllPlatforms({
        trigger: 'worker',
        includeOrders: true,
        includeRefunds: true
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Platform polling failed');
    } finally {
      this.running = false;
    }
  }

  private getIntervalMs() {
    const value = Number(process.env.PLATFORM_POLL_INTERVAL_MS);
    if (!Number.isFinite(value) || value < 60_000) {
      return DEFAULT_PLATFORM_POLL_INTERVAL_MS;
    }
    return Math.floor(value);
  }
}

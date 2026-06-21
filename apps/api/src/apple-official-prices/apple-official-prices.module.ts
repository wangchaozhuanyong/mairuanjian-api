import { Module } from '@nestjs/common';
import { AppleServicesModule } from '../apple-services/apple-services.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AppleOfficialPricePollingWorker } from './apple-official-price-polling.worker';
import { AppleOfficialPricesController } from './apple-official-prices.controller';
import { AppleOfficialPricesService } from './apple-official-prices.service';

@Module({
  imports: [AppleServicesModule, AuditLogsModule, PrismaModule, RealtimeModule],
  controllers: [AppleOfficialPricesController],
  providers: [AppleOfficialPricesService, AppleOfficialPricePollingWorker],
  exports: [AppleOfficialPricesService]
})
export class AppleOfficialPricesModule {}

import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CodeOrdersModule } from '../code-orders/code-orders.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ManualDeliveryAdapter } from './adapters/manual-delivery.adapter';
import {
  TaobaoDeliveryAdapter,
  XianyuDeliveryAdapter
} from './adapters/unsupported-platform-delivery.adapter';
import { PlatformDeliveryController } from './platform-delivery.controller';
import { PlatformDeliveryService } from './platform-delivery.service';
import { PlatformPollingWorker } from './platform-polling.worker';

@Module({
  imports: [AuditLogsModule, CodeOrdersModule, PrismaModule, NotificationsModule, RealtimeModule],
  controllers: [PlatformDeliveryController],
  providers: [
    PlatformDeliveryService,
    PlatformPollingWorker,
    ManualDeliveryAdapter,
    TaobaoDeliveryAdapter,
    XianyuDeliveryAdapter
  ]
})
export class PlatformDeliveryModule {}

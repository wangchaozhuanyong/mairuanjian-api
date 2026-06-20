import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DataCenterController } from './data-center.controller';
import { DataCenterService } from './data-center.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule, RealtimeModule],
  controllers: [DataCenterController],
  providers: [DataCenterService]
})
export class DataCenterModule {}

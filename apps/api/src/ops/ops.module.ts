import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule, RealtimeModule],
  controllers: [OpsController],
  providers: [OpsService, FieldEncryptionService]
})
export class OpsModule {}

import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, FieldEncryptionService],
  exports: [NotificationsService]
})
export class NotificationsModule {}

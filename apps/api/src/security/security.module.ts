import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, NotificationsModule, RealtimeModule],
  controllers: [SecurityController],
  providers: [SecurityService, FieldEncryptionService],
  exports: [SecurityService]
})
export class SecurityModule {}

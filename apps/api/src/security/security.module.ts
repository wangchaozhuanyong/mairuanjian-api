import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, NotificationsModule],
  controllers: [SecurityController],
  providers: [SecurityService, FieldEncryptionService],
  exports: [SecurityService]
})
export class SecurityModule {}

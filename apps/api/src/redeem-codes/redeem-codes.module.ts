import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RedeemCodesController } from './redeem-codes.controller';
import { RedeemCodesService } from './redeem-codes.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, NotificationsModule, RealtimeModule],
  controllers: [RedeemCodesController],
  providers: [RedeemCodesService, FieldEncryptionService],
  exports: [RedeemCodesService]
})
export class RedeemCodesModule {}

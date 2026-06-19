import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppleAccountStatusChecksController } from './apple-account-status-checks.controller';
import { AppleAccountStatusChecksService } from './apple-account-status-checks.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, NotificationsModule],
  controllers: [AppleAccountStatusChecksController],
  providers: [AppleAccountStatusChecksService]
})
export class AppleAccountStatusChecksModule {}

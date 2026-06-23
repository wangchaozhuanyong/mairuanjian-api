import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AppleRenewalTasksController } from './apple-renewal-tasks.controller';
import { AppleRenewalTasksService } from './apple-renewal-tasks.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, NotificationsModule, RealtimeModule],
  controllers: [AppleRenewalTasksController],
  providers: [AppleRenewalTasksService],
  exports: [AppleRenewalTasksService]
})
export class AppleRenewalTasksModule {}

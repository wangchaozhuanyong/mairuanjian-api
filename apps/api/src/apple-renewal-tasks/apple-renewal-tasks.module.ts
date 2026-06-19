import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppleRenewalTasksController } from './apple-renewal-tasks.controller';
import { AppleRenewalTasksService } from './apple-renewal-tasks.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, NotificationsModule],
  controllers: [AppleRenewalTasksController],
  providers: [AppleRenewalTasksService]
})
export class AppleRenewalTasksModule {}

import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AppleRenewalTasksModule } from '../apple-renewal-tasks/apple-renewal-tasks.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AppleActionPlansController } from './apple-action-plans.controller';
import { AppleActionPlansService } from './apple-action-plans.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, AppleRenewalTasksModule, RealtimeModule],
  controllers: [AppleActionPlansController],
  providers: [AppleActionPlansService]
})
export class AppleActionPlansModule {}

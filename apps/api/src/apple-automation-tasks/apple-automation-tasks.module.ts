import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AppleAutomationTasksController } from './apple-automation-tasks.controller';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';
import { AppleWebCheckWorker } from './apple-web-check.worker';

@Module({
  imports: [AuditLogsModule, PrismaModule, RealtimeModule],
  controllers: [AppleAutomationTasksController],
  providers: [AppleAutomationTasksService, AppleWebCheckWorker, FieldEncryptionService]
})
export class AppleAutomationTasksModule {}

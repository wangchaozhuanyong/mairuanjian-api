import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppleAutomationTasksController } from './apple-automation-tasks.controller';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';

@Module({
  imports: [AuditLogsModule, PrismaModule],
  controllers: [AppleAutomationTasksController],
  providers: [AppleAutomationTasksService, FieldEncryptionService]
})
export class AppleAutomationTasksModule {}

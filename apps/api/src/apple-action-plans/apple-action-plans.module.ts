import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppleActionPlansController } from './apple-action-plans.controller';
import { AppleActionPlansService } from './apple-action-plans.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [AppleActionPlansController],
  providers: [AppleActionPlansService]
})
export class AppleActionPlansModule {}

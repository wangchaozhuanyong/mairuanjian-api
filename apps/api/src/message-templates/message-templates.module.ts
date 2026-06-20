import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessageTemplatesController } from './message-templates.controller';
import { MessageTemplatesService } from './message-templates.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, RealtimeModule],
  controllers: [MessageTemplatesController],
  providers: [MessageTemplatesService]
})
export class MessageTemplatesModule {}

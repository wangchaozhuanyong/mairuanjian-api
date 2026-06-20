import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AppleMatchingController, AppleOrdersController } from './apple-orders.controller';
import { AppleOrdersService } from './apple-orders.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, RealtimeModule],
  controllers: [AppleOrdersController, AppleMatchingController],
  providers: [AppleOrdersService]
})
export class AppleOrdersModule {}

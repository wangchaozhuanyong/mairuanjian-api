import { Module } from '@nestjs/common';
import { AppleAccountsModule } from '../apple-accounts/apple-accounts.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AppleAccountSourceChannelsController } from './apple-account-source-channels.controller';
import { AppleAccountSourceChannelsService } from './apple-account-source-channels.service';

@Module({
  imports: [AppleAccountsModule, AuditLogsModule, PrismaModule, RealtimeModule],
  controllers: [AppleAccountSourceChannelsController],
  providers: [AppleAccountSourceChannelsService]
})
export class AppleAccountSourceChannelsModule {}

import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AppleBalancesController, AppleTopupsController } from './apple-balances.controller';
import { AppleBalancesService } from './apple-balances.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, RealtimeModule],
  controllers: [AppleBalancesController, AppleTopupsController],
  providers: [AppleBalancesService, FieldEncryptionService]
})
export class AppleBalancesModule {}

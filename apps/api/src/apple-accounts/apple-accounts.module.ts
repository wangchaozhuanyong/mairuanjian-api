import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppleAccountsController } from './apple-accounts.controller';
import { AppleAccountsService } from './apple-accounts.service';

@Module({
  imports: [AuditLogsModule, PrismaModule],
  controllers: [AppleAccountsController],
  providers: [AppleAccountsService, FieldEncryptionService]
})
export class AppleAccountsModule {}

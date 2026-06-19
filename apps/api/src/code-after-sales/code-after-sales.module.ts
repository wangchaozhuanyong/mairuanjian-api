import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CodeAfterSalesController } from './code-after-sales.controller';
import { CodeAfterSalesService } from './code-after-sales.service';

@Module({
  imports: [AuditLogsModule, PrismaModule],
  controllers: [CodeAfterSalesController],
  providers: [CodeAfterSalesService, FieldEncryptionService],
  exports: [CodeAfterSalesService]
})
export class CodeAfterSalesModule {}

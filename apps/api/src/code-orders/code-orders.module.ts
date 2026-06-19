import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CodeDeliveriesController } from './code-deliveries.controller';
import { CodeOrdersController } from './code-orders.controller';
import { CodeOrdersService } from './code-orders.service';

@Module({
  imports: [AuditLogsModule, PrismaModule, NotificationsModule],
  controllers: [CodeOrdersController, CodeDeliveriesController],
  providers: [CodeOrdersService, FieldEncryptionService],
  exports: [CodeOrdersService]
})
export class CodeOrdersModule {}

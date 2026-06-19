import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuditLogsModule, PrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService]
})
export class CustomersModule {}

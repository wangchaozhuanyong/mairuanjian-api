import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CodePlatformMappingsController, CodeServicesController } from './code-services.controller';
import { CodeServicesService } from './code-services.service';

@Module({
  imports: [AuditLogsModule, PrismaModule],
  controllers: [CodeServicesController, CodePlatformMappingsController],
  providers: [CodeServicesService],
  exports: [CodeServicesService]
})
export class CodeServicesModule {}

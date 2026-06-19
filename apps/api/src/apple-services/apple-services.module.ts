import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import {
  AppleServicePlatformMappingsController,
  AppleServicesController
} from './apple-services.controller';
import { AppleServicesService } from './apple-services.service';

@Module({
  imports: [AuditLogsModule, PrismaModule],
  controllers: [AppleServicesController, AppleServicePlatformMappingsController],
  providers: [AppleServicesService],
  exports: [AppleServicesService]
})
export class AppleServicesModule {}

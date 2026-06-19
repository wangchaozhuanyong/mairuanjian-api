import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService]
})
export class MaintenanceModule {}

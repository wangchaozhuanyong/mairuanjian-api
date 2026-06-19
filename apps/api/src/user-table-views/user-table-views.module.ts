import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UserTableViewsController } from './user-table-views.controller';
import { UserTableViewsService } from './user-table-views.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [UserTableViewsController],
  providers: [UserTableViewsService]
})
export class UserTableViewsModule {}

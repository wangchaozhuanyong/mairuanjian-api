import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SourcePlatformsController } from './source-platforms.controller';
import { SourcePlatformsService } from './source-platforms.service';

@Module({
  imports: [AuditLogsModule, PrismaModule],
  controllers: [SourcePlatformsController],
  providers: [SourcePlatformsService]
})
export class SourcePlatformsModule {}

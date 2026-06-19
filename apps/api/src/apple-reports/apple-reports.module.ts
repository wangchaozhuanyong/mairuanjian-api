import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppleReportsController } from './apple-reports.controller';
import { AppleReportsService } from './apple-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppleReportsController],
  providers: [AppleReportsService]
})
export class AppleReportsModule {}

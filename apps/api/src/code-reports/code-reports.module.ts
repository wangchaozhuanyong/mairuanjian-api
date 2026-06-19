import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CodeReportsController } from './code-reports.controller';
import { CodeReportsService } from './code-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [CodeReportsController],
  providers: [CodeReportsService]
})
export class CodeReportsModule {}

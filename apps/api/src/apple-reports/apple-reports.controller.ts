import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import { AppleReportsService } from './apple-reports.service';

@Controller('apple/reports')
export class AppleReportsController {
  constructor(private readonly appleReportsService: AppleReportsService) {}

  @Get('profit')
  @RequirePermissions('apple.report.view')
  getProfitReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('sourcePlatformId') sourcePlatformId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('appleAccountId') appleAccountId?: string
  ) {
    return this.appleReportsService.getProfitReport({
      dateFrom,
      dateTo,
      keyword,
      status,
      customerId,
      sourcePlatformId,
      serviceId,
      appleAccountId
    });
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import { CodeReportsService } from './code-reports.service';

@Controller('codes/reports')
export class CodeReportsController {
  constructor(private readonly codeReportsService: CodeReportsService) {}

  @Get('profit')
  @RequirePermissions('code.report.view')
  getProfitReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('keyword') keyword?: string,
    @Query('platformId') platformId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('deliveryStatus') deliveryStatus?: string
  ) {
    return this.codeReportsService.getProfitReport({
      dateFrom,
      dateTo,
      keyword,
      platformId,
      serviceId,
      deliveryStatus
    });
  }

  @Get('platform-profit')
  @RequirePermissions('code.report.view')
  getPlatformProfitReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('keyword') keyword?: string,
    @Query('platformId') platformId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('deliveryStatus') deliveryStatus?: string
  ) {
    return this.codeReportsService.getProfitReport({
      dateFrom,
      dateTo,
      keyword,
      platformId,
      serviceId,
      deliveryStatus
    });
  }
}

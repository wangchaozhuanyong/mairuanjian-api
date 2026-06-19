import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import { AppleActivationsService } from './apple-activations.service';

@Controller('apple/activations')
@RequirePermissions('apple.activation.view')
export class AppleActivationsController {
  constructor(private readonly appleActivationsService: AppleActivationsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('appleAccountId') appleAccountId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('sourcePlatformId') sourcePlatformId?: string,
    @Query('autoRenewStatus') autoRenewStatus?: string,
    @Query('renewalDecision') renewalDecision?: string,
    @Query('expireFrom') expireFrom?: string,
    @Query('expireTo') expireTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.appleActivationsService.list({
      page,
      pageSize,
      keyword,
      status,
      customerId,
      appleAccountId,
      serviceId,
      sourcePlatformId,
      autoRenewStatus,
      renewalDecision,
      expireFrom,
      expireTo,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.appleActivationsService.get(id);
  }
}

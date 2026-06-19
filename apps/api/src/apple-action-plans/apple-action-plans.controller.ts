import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AppleActionPlansService,
  type CompleteActionPlanDto,
  type GenerateActionPlansDto
} from './apple-action-plans.service';

@Controller('apple/action-plans')
export class AppleActionPlansController {
  constructor(private readonly appleActionPlansService: AppleActionPlansService) {}

  @Get()
  @RequirePermissions('apple.action_plan.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('appleAccountId') appleAccountId?: string,
    @Query('hasWrongChargeRisk') hasWrongChargeRisk?: string,
    @Query('planDateFrom') planDateFrom?: string,
    @Query('planDateTo') planDateTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.appleActionPlansService.list({
      page,
      pageSize,
      keyword,
      status,
      appleAccountId,
      hasWrongChargeRisk,
      planDateFrom,
      planDateTo,
      sortBy,
      sortOrder
    });
  }

  @Post('generate')
  @RequirePermissions('apple.action_plan.update')
  generate(@Body() dto: GenerateActionPlansDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleActionPlansService.generate(dto, operator);
  }

  @Get(':id')
  @RequirePermissions('apple.action_plan.view')
  get(@Param('id') id: string) {
    return this.appleActionPlansService.get(id);
  }

  @Get(':id/items')
  @RequirePermissions('apple.action_plan.view')
  listItems(@Param('id') id: string) {
    return this.appleActionPlansService.listItems(id);
  }

  @Post(':id/complete')
  @RequirePermissions('apple.action_plan.update')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteActionPlanDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleActionPlansService.complete(id, dto, operator);
  }
}

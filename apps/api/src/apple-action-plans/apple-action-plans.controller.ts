import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AppleActionPlansService,
  type CompleteActionPlanDto,
  type GenerateActionPlansDto
} from './apple-action-plans.service';

@Controller('apple/action-plans')
export class AppleActionPlansController {
  constructor(
    private readonly appleActionPlansService: AppleActionPlansService,
    private readonly realtimeService: RealtimeService
  ) {}

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
  async generate(@Body() dto: GenerateActionPlansDto, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.appleActionPlansService.generate(dto, operator);
    this.realtimeService.publish({
      type: 'apple.action_plan.generated',
      module: 'apple',
      entity: 'action_plan',
      action: 'generated',
      scope: {
        scannedActivations: result.scannedActivations,
        accountCount: result.accountCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        itemCount: result.itemCount,
        daysAhead: result.daysAhead
      }
    });
    return result;
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
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteActionPlanDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const plan = await this.appleActionPlansService.complete(id, dto, operator);
    this.realtimeService.publish({
      type: 'apple.action_plan.completed',
      module: 'apple',
      entity: 'action_plan',
      action: 'completed',
      resourceId: plan.id,
      scope: {
        appleAccountId: plan.appleAccountId
      }
    });
    return plan;
  }
}

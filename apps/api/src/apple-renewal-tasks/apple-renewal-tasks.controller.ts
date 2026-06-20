import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AppleRenewalTasksService,
  type CancelRenewalTaskDto,
  type CompleteRenewalTaskDto,
  type CreateRenewalTaskDto,
  type GenerateDueTasksDto,
  type PostponeRenewalTaskDto,
  type UpdateRenewalTaskDto
} from './apple-renewal-tasks.service';

@Controller('apple/renewal-tasks')
export class AppleRenewalTasksController {
  constructor(
    private readonly appleRenewalTasksService: AppleRenewalTasksService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('apple.renewal_task.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('taskType') taskType?: string,
    @Query('priority') priority?: string,
    @Query('customerDecision') customerDecision?: string,
    @Query('customerId') customerId?: string,
    @Query('appleAccountId') appleAccountId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('activationId') activationId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('dueFrom') dueFrom?: string,
    @Query('dueTo') dueTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.appleRenewalTasksService.list({
      page,
      pageSize,
      keyword,
      status,
      taskType,
      priority,
      customerDecision,
      customerId,
      appleAccountId,
      serviceId,
      activationId,
      assignedToUserId,
      dueFrom,
      dueTo,
      sortBy,
      sortOrder
    });
  }

  @Post()
  @RequirePermissions('apple.renewal_task.update')
  async create(@Body() dto: CreateRenewalTaskDto, @CurrentUser() operator?: AuthenticatedUser) {
    const task = await this.appleRenewalTasksService.create(dto, operator);
    this.publishRenewalTaskEvent('apple.renewal_task.created', 'created', task.id);
    return task;
  }

  @Post('generate-due-tasks')
  @RequirePermissions('apple.renewal_task.update')
  async generateDueTasks(
    @Body() dto: GenerateDueTasksDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.appleRenewalTasksService.generateDueTasks(dto, operator);
    this.realtimeService.publish({
      type: 'apple.renewal_task.generated',
      module: 'apple',
      entity: 'renewal_task',
      action: 'generated',
      scope: {
        scannedActivations: result.scannedActivations,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        daysAhead: result.daysAhead
      }
    });
    return result;
  }

  @Get(':id')
  @RequirePermissions('apple.renewal_task.view')
  get(@Param('id') id: string) {
    return this.appleRenewalTasksService.get(id);
  }

  @Patch(':id')
  @RequirePermissions('apple.renewal_task.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const task = await this.appleRenewalTasksService.update(id, dto, operator);
    this.publishRenewalTaskEvent('apple.renewal_task.updated', 'updated', task.id);
    return task;
  }

  @Post(':id/complete')
  @RequirePermissions('apple.renewal_task.update')
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const task = await this.appleRenewalTasksService.complete(id, dto, operator);
    this.publishRenewalTaskEvent('apple.renewal_task.completed', 'completed', task.id);
    return task;
  }

  @Post(':id/cancel')
  @RequirePermissions('apple.renewal_task.update')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const task = await this.appleRenewalTasksService.cancel(id, dto, operator);
    this.publishRenewalTaskEvent('apple.renewal_task.cancelled', 'cancelled', task.id);
    return task;
  }

  @Post(':id/postpone')
  @RequirePermissions('apple.renewal_task.update')
  async postpone(
    @Param('id') id: string,
    @Body() dto: PostponeRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const task = await this.appleRenewalTasksService.postpone(id, dto, operator);
    this.publishRenewalTaskEvent('apple.renewal_task.postponed', 'postponed', task.id);
    return task;
  }

  private publishRenewalTaskEvent(type: string, action: string, taskId: string) {
    this.realtimeService.publish({
      type,
      module: 'apple',
      entity: 'renewal_task',
      action,
      resourceId: taskId
    });
  }
}

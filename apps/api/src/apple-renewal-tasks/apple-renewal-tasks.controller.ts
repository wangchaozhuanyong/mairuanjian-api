import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
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
  constructor(private readonly appleRenewalTasksService: AppleRenewalTasksService) {}

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
  create(@Body() dto: CreateRenewalTaskDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleRenewalTasksService.create(dto, operator);
  }

  @Post('generate-due-tasks')
  @RequirePermissions('apple.renewal_task.update')
  generateDueTasks(@Body() dto: GenerateDueTasksDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleRenewalTasksService.generateDueTasks(dto, operator);
  }

  @Get(':id')
  @RequirePermissions('apple.renewal_task.view')
  get(@Param('id') id: string) {
    return this.appleRenewalTasksService.get(id);
  }

  @Patch(':id')
  @RequirePermissions('apple.renewal_task.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleRenewalTasksService.update(id, dto, operator);
  }

  @Post(':id/complete')
  @RequirePermissions('apple.renewal_task.update')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleRenewalTasksService.complete(id, dto, operator);
  }

  @Post(':id/cancel')
  @RequirePermissions('apple.renewal_task.update')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleRenewalTasksService.cancel(id, dto, operator);
  }

  @Post(':id/postpone')
  @RequirePermissions('apple.renewal_task.update')
  postpone(
    @Param('id') id: string,
    @Body() dto: PostponeRenewalTaskDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleRenewalTasksService.postpone(id, dto, operator);
  }
}

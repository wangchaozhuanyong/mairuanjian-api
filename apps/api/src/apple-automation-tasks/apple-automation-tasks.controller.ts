import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';
import type { AutomationTaskResultDto } from './dto/automation-task-result.dto';
import type { CreateAutomationTaskDto } from './dto/create-automation-task.dto';
import type { MarkAutomationTaskManualDto } from './dto/mark-automation-task-manual.dto';

@Controller('apple/automation-tasks')
export class AppleAutomationTasksController {
  constructor(private readonly automationTasksService: AppleAutomationTasksService) {}

  @Get()
  @RequirePermissions('apple.automation_task.manage')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('taskType') taskType?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('appleAccountId') appleAccountId?: string,
    @Query('manualRequired') manualRequired?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.automationTasksService.list({
      page,
      pageSize,
      keyword,
      taskType,
      status,
      priority,
      appleAccountId,
      manualRequired,
      sortBy,
      sortOrder
    });
  }

  @Post()
  @RequirePermissions('apple.automation_task.manage')
  create(@Body() dto: CreateAutomationTaskDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.automationTasksService.create(dto, operator);
  }

  @Get(':id')
  @RequirePermissions('apple.automation_task.manage')
  get(@Param('id') id: string) {
    return this.automationTasksService.get(id);
  }

  @Get(':id/logs')
  @RequirePermissions('apple.automation_task.manage')
  listLogs(@Param('id') id: string) {
    return this.automationTasksService.listLogs(id);
  }

  @Post(':id/run-placeholder')
  @RequirePermissions('apple.automation_task.manage')
  runPlaceholder(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.automationTasksService.runPlaceholder(id, operator);
  }

  @Post(':id/cancel')
  @RequirePermissions('apple.automation_task.manage')
  cancel(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.automationTasksService.cancel(id, operator);
  }

  @Post(':id/retry')
  @RequirePermissions('apple.automation_task.manage')
  retry(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.automationTasksService.retry(id, operator);
  }

  @Post(':id/mark-manual')
  @RequirePermissions('apple.automation_task.manage')
  markManual(
    @Param('id') id: string,
    @Body() dto: MarkAutomationTaskManualDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.automationTasksService.markManual(id, dto, operator);
  }

  @Post(':id/result')
  @RequirePermissions('apple.automation_task.manage')
  writeResult(
    @Param('id') id: string,
    @Body() dto: AutomationTaskResultDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.automationTasksService.writeResult(id, dto, operator);
  }
}

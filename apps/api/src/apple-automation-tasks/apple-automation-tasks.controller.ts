import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';
import type { AutomationTaskResultDto } from './dto/automation-task-result.dto';
import type { CreateAutomationTaskDto } from './dto/create-automation-task.dto';
import type { MarkAutomationTaskManualDto } from './dto/mark-automation-task-manual.dto';

@Controller('apple/automation-tasks')
export class AppleAutomationTasksController {
  constructor(
    private readonly automationTasksService: AppleAutomationTasksService,
    private readonly realtimeService: RealtimeService
  ) {}

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
  async create(@Body() dto: CreateAutomationTaskDto, @CurrentUser() operator?: AuthenticatedUser) {
    const task = await this.automationTasksService.create(dto, operator);
    this.publishAutomationTaskEvent('apple.automation_task.created', 'created', task.id, {
      appleAccountId: task.appleAccountId
    });
    return task;
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
  async runPlaceholder(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const task = await this.automationTasksService.runPlaceholder(id, operator);
    this.publishAutomationTaskEvent('apple.automation_task.ran', 'ran', task.id, {
      appleAccountId: task.appleAccountId
    });
    return task;
  }

  @Post(':id/cancel')
  @RequirePermissions('apple.automation_task.manage')
  async cancel(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const task = await this.automationTasksService.cancel(id, operator);
    this.publishAutomationTaskEvent('apple.automation_task.cancelled', 'cancelled', task.id, {
      appleAccountId: task.appleAccountId
    });
    return task;
  }

  @Post(':id/retry')
  @RequirePermissions('apple.automation_task.manage')
  async retry(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const task = await this.automationTasksService.retry(id, operator);
    this.publishAutomationTaskEvent('apple.automation_task.retried', 'retried', task.id, {
      appleAccountId: task.appleAccountId
    });
    return task;
  }

  @Post(':id/mark-manual')
  @RequirePermissions('apple.automation_task.manage')
  async markManual(
    @Param('id') id: string,
    @Body() dto: MarkAutomationTaskManualDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const task = await this.automationTasksService.markManual(id, dto, operator);
    this.publishAutomationTaskEvent(
      'apple.automation_task.manual_required',
      'manual_required',
      task.id,
      {
        appleAccountId: task.appleAccountId
      }
    );
    return task;
  }

  @Post(':id/result')
  @RequirePermissions('apple.automation_task.manage')
  async writeResult(
    @Param('id') id: string,
    @Body() dto: AutomationTaskResultDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const task = await this.automationTasksService.writeResult(id, dto, operator);
    this.publishAutomationTaskEvent(
      'apple.automation_task.result_written',
      'result_written',
      task.id,
      {
        appleAccountId: task.appleAccountId
      }
    );
    return task;
  }

  private publishAutomationTaskEvent(
    type: string,
    action: string,
    taskId: string,
    scope?: { appleAccountId?: string | null }
  ) {
    this.realtimeService.publish({
      type,
      module: 'apple',
      entity: 'automation_task',
      action,
      resourceId: taskId,
      scope
    });
  }
}

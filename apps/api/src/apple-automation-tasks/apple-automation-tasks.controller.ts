import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';
import type { AutomationTaskResultDto } from './dto/automation-task-result.dto';
import type { BatchBalanceCheckDto } from './dto/batch-balance-check.dto';
import type { BatchStatusCheckDto } from './dto/batch-status-check.dto';
import type { CreateAutomationTaskDto } from './dto/create-automation-task.dto';
import type { MarkAutomationTaskManualDto } from './dto/mark-automation-task-manual.dto';
import type { WebCheckGatewayAttemptDto } from './dto/web-check-gateway-attempt.dto';

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

  @Post('batch-status-check')
  @RequirePermissions('apple.automation_task.manage')
  async batchStatusCheck(
    @Body() dto: BatchStatusCheckDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.automationTasksService.batchStatusCheck(dto, operator);
    for (const task of result.items) {
      this.publishAutomationTaskEvent('apple.automation_task.created', 'created', task.id, {
        appleAccountId: task.appleAccountId
      });
    }
    return result;
  }

  @Post('batches/status-check')
  @RequirePermissions('apple.automation_task.manage')
  async createStatusCheckBatch(
    @Body() dto: BatchStatusCheckDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.automationTasksService.createStatusCheckBatch(dto, operator);
    this.publishAutomationTaskEvent(
      'apple.automation_task.batch_created',
      'batch_created',
      result.batch.id
    );
    return result;
  }

  @Post('batches/balance-check')
  @RequirePermissions('apple.automation_task.manage')
  async createBalanceCheckBatch(
    @Body() dto: BatchBalanceCheckDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.automationTasksService.createBalanceCheckBatch(dto, operator);
    this.publishAutomationTaskEvent(
      'apple.automation_task.batch_created',
      'batch_created',
      result.batch.id
    );
    return result;
  }

  @Get('batches/:id')
  @RequirePermissions('apple.automation_task.manage')
  getBatch(@Param('id') id: string) {
    return this.automationTasksService.getBatch(id);
  }

  @Get('batches/:id/results')
  @RequirePermissions('apple.automation_task.manage')
  getBatchResults(@Param('id') id: string) {
    return this.automationTasksService.getBatchResults(id);
  }

  @Get('workbench-status')
  @RequirePermissions('apple.automation_task.manage')
  workbenchStatus() {
    return this.automationTasksService.workbenchStatus();
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

  @Get(':id/web-check-gateways')
  @RequirePermissions('apple.automation_task.manage')
  webCheckGateways(@Param('id') id: string) {
    return this.automationTasksService.webCheckGateways(id);
  }

  @Post(':id/web-check-gateway-attempt')
  @RequirePermissions('apple.automation_task.manage')
  async recordWebCheckGatewayAttempt(
    @Param('id') id: string,
    @Body() dto: WebCheckGatewayAttemptDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.automationTasksService.recordWebCheckGatewayAttempt(
      id,
      dto,
      operator
    );
    this.publishAutomationTaskEvent(
      'apple.automation_task.gateway_attempt_recorded',
      'gateway_attempt_recorded',
      result.task.id,
      {
        appleAccountId: result.task.appleAccountId
      }
    );
    return result;
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

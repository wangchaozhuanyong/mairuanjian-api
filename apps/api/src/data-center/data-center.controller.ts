import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type {
  CreateBackupJobInput,
  CreateCleanupJobInput,
  CreateDataDictionaryInput,
  CreateDuplicateMergeJobInput,
  CreateExportJobInput,
  CreateImportJobInput,
  CreateRestoreJobInput,
  ExecuteRestoreJobInput,
  SaveSystemParameterInput,
  UpdateBackupJobStatusInput,
  UpdateDataDictionaryInput,
  UpdateGenericJobStatusInput
} from './data-center.service';
import { DataCenterService } from './data-center.service';

interface DownloadResponse {
  setHeader(name: string, value: string): void;
}

@Controller('data')
export class DataCenterController {
  constructor(
    private readonly dataCenterService: DataCenterService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get('overview')
  @RequirePermissions('data.overview.view')
  overview() {
    return this.dataCenterService.overview();
  }

  @Get('backup-jobs')
  @RequirePermissions('data.backup.view')
  listBackupJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listBackupJobs({
      page,
      pageSize,
      keyword,
      status,
      jobType,
      sortBy,
      sortOrder
    });
  }

  @Post('backup-jobs')
  @RequirePermissions('data.backup.create')
  async createBackupJob(
    @Body() dto: CreateBackupJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.createBackupJob(dto, operator);
    this.publishDataEvent('data.backup_job.created', 'backup_job', 'created', job.id);
    return job;
  }

  @Patch('backup-jobs/:id/status')
  @RequirePermissions('data.backup.create')
  async updateBackupJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBackupJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.updateBackupJobStatus(id, dto, operator);
    this.publishDataEvent('data.backup_job.updated', 'backup_job', 'updated', id);
    return job;
  }

  @Post('backup-jobs/:id/execute')
  @RequirePermissions('data.backup.create')
  async executeBackupJob(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const job = await this.dataCenterService.executeBackupJob(id, operator);
    this.publishDataEvent('data.backup_job.executed', 'backup_job', 'executed', id);
    return job;
  }

  @Get('restore-jobs')
  @RequirePermissions('data.restore.view')
  listRestoreJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('backupJobId') backupJobId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listRestoreJobs({
      page,
      pageSize,
      keyword,
      status,
      backupJobId,
      sortBy,
      sortOrder
    });
  }

  @Post('restore-jobs')
  @RequirePermissions('data.restore.create')
  async createRestoreJob(
    @Body() dto: CreateRestoreJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.createRestoreJob(dto, operator);
    this.publishDataEvent('data.restore_job.created', 'restore_job', 'created', job.id);
    return job;
  }

  @Patch('restore-jobs/:id/status')
  @RequirePermissions('data.restore.create')
  async updateRestoreJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.updateRestoreJobStatus(id, dto, operator);
    this.publishDataEvent('data.restore_job.updated', 'restore_job', 'updated', id);
    return job;
  }

  @Post('restore-jobs/:id/execute')
  @RequirePermissions('data.restore.create')
  async executeRestoreJob(
    @Param('id') id: string,
    @Body() dto: ExecuteRestoreJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.executeRestoreJob(id, dto, operator);
    this.publishDataEvent('data.restore_job.executed', 'restore_job', 'executed', id);
    return job;
  }

  @Get('import-jobs')
  @RequirePermissions('data.import.view')
  listImportJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('module') module?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listImportJobs({
      page,
      pageSize,
      keyword,
      status,
      module,
      sortBy,
      sortOrder
    });
  }

  @Post('import-jobs')
  @RequirePermissions('data.import.create')
  async createImportJob(
    @Body() dto: CreateImportJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.createImportJob(dto, operator);
    this.publishDataEvent('data.import_job.created', 'import_job', 'created', job.id);
    return job;
  }

  @Patch('import-jobs/:id/status')
  @RequirePermissions('data.import.create')
  async updateImportJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.updateImportJobStatus(id, dto, operator);
    this.publishDataEvent('data.import_job.updated', 'import_job', 'updated', id);
    return job;
  }

  @Post('import-jobs/:id/execute')
  @RequirePermissions('data.import.create')
  async executeImportJob(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const job = await this.dataCenterService.executeImportJob(id, operator);
    this.publishDataEvent('data.import_job.executed', 'import_job', 'executed', id);
    return job;
  }

  @Get('import-jobs/:id/error-report')
  @RequirePermissions('data.import.view')
  async getImportErrorReport(
    @Param('id') id: string,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Res({ passthrough: true }) response: DownloadResponse
  ) {
    const file = await this.dataCenterService.getImportErrorReport(id, operator);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', this.buildContentDisposition(file.fileName));
    return new StreamableFile(createReadStream(file.absolutePath));
  }

  @Get('export-jobs')
  @RequirePermissions('data.export.view')
  listExportJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('module') module?: string,
    @Query('containsSensitive') containsSensitive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listExportJobs({
      page,
      pageSize,
      keyword,
      status,
      module,
      containsSensitive,
      sortBy,
      sortOrder
    });
  }

  @Post('export-jobs')
  @RequirePermissions('data.export.create')
  async createExportJob(
    @Body() dto: CreateExportJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.createExportJob(dto, operator);
    this.publishDataEvent('data.export_job.created', 'export_job', 'created', job.id);
    return job;
  }

  @Patch('export-jobs/:id/status')
  @RequirePermissions('data.export.create')
  async updateExportJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.updateExportJobStatus(id, dto, operator);
    this.publishDataEvent('data.export_job.updated', 'export_job', 'updated', id);
    return job;
  }

  @Post('export-jobs/:id/execute')
  @RequirePermissions('data.export.create')
  async executeExportJob(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const job = await this.dataCenterService.executeExportJob(id, operator);
    this.publishDataEvent('data.export_job.executed', 'export_job', 'executed', id);
    return job;
  }

  @Get('export-jobs/:id/download')
  @RequirePermissions('data.export.view')
  async getExportDownload(
    @Param('id') id: string,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Res({ passthrough: true }) response: DownloadResponse
  ) {
    const file = await this.dataCenterService.getExportDownload(id, operator);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', this.buildContentDisposition(file.fileName));
    return new StreamableFile(createReadStream(file.absolutePath));
  }

  @Get('recycle-bin')
  @RequirePermissions('data.recycle_bin.view')
  listRecycleBin(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('module') module?: string,
    @Query('objectType') objectType?: string,
    @Query('restored') restored?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listRecycleBin({
      page,
      pageSize,
      keyword,
      module,
      objectType,
      restored,
      sortBy,
      sortOrder
    });
  }

  @Post('recycle-bin/:id/restore')
  @RequirePermissions('data.recycle_bin.restore')
  async restoreRecycleBinRecord(
    @Param('id') id: string,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const record = await this.dataCenterService.restoreRecycleBinRecord(id, operator);
    this.publishDataEvent('data.recycle_bin.restored', 'recycle_bin_record', 'restored', id);
    return record;
  }

  @Delete('recycle-bin/:id')
  @RequirePermissions('data.recycle_bin.restore')
  async purgeRecycleBinRecord(
    @Param('id') id: string,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.dataCenterService.purgeRecycleBinRecord(id, operator);
    this.publishDataEvent('data.recycle_bin.purged', 'recycle_bin_record', 'purged', id);
    return result;
  }

  @Get('cleanup-jobs')
  @RequirePermissions('data.cleanup.manage')
  listCleanupJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('module') module?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listCleanupJobs({
      page,
      pageSize,
      keyword,
      status,
      module,
      sortBy,
      sortOrder
    });
  }

  @Post('cleanup-jobs')
  @RequirePermissions('data.cleanup.manage')
  async createCleanupJob(
    @Body() dto: CreateCleanupJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.createCleanupJob(dto, operator);
    this.publishDataEvent('data.cleanup_job.created', 'cleanup_job', 'created', job.id);
    return job;
  }

  @Patch('cleanup-jobs/:id/status')
  @RequirePermissions('data.cleanup.manage')
  async updateCleanupJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.updateCleanupJobStatus(id, dto, operator);
    this.publishDataEvent('data.cleanup_job.updated', 'cleanup_job', 'updated', id);
    return job;
  }

  @Get('duplicate-merge-jobs')
  @RequirePermissions('data.duplicate_merge.manage')
  listDuplicateMergeJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('module') module?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listDuplicateMergeJobs({
      page,
      pageSize,
      keyword,
      status,
      module,
      sortBy,
      sortOrder
    });
  }

  @Post('duplicate-merge-jobs')
  @RequirePermissions('data.duplicate_merge.manage')
  async createDuplicateMergeJob(
    @Body() dto: CreateDuplicateMergeJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.createDuplicateMergeJob(dto, operator);
    this.publishDataEvent(
      'data.duplicate_merge_job.created',
      'duplicate_merge_job',
      'created',
      job.id
    );
    return job;
  }

  @Patch('duplicate-merge-jobs/:id/status')
  @RequirePermissions('data.duplicate_merge.manage')
  async updateDuplicateMergeJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const job = await this.dataCenterService.updateDuplicateMergeJobStatus(id, dto, operator);
    this.publishDataEvent('data.duplicate_merge_job.updated', 'duplicate_merge_job', 'updated', id);
    return job;
  }

  @Get('dictionaries')
  @RequirePermissions('data.dictionary.manage')
  listDictionaries(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('group') group?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listDictionaries({
      page,
      pageSize,
      keyword,
      group,
      status,
      sortBy,
      sortOrder
    });
  }

  @Post('dictionaries')
  @RequirePermissions('data.dictionary.manage')
  async createDictionary(
    @Body() dto: CreateDataDictionaryInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const dictionary = await this.dataCenterService.createDictionary(dto, operator);
    this.publishDataEvent('data.dictionary.created', 'dictionary', 'created', dictionary.id);
    return dictionary;
  }

  @Patch('dictionaries/:id')
  @RequirePermissions('data.dictionary.manage')
  async updateDictionary(
    @Param('id') id: string,
    @Body() dto: UpdateDataDictionaryInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const dictionary = await this.dataCenterService.updateDictionary(id, dto, operator);
    this.publishDataEvent('data.dictionary.updated', 'dictionary', 'updated', id);
    return dictionary;
  }

  @Get('system-parameters')
  @RequirePermissions('data.system_parameter.manage')
  listSystemParameters(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('group') group?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.dataCenterService.listSystemParameters({
      page,
      pageSize,
      keyword,
      group,
      sortBy,
      sortOrder
    });
  }

  @Patch('system-parameters/:key')
  @RequirePermissions('data.system_parameter.manage')
  async saveSystemParameter(
    @Param('key') key: string,
    @Body() dto: SaveSystemParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const parameter = await this.dataCenterService.saveSystemParameter(key, dto, operator);
    this.publishDataEvent('data.system_parameter.saved', 'system_parameter', 'saved', key);
    return parameter;
  }

  private buildContentDisposition(fileName: string) {
    const fallbackName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`;
  }

  private publishDataEvent(
    type: string,
    entity: string,
    action: string,
    resourceId?: string | null
  ) {
    this.realtimeService.publish({
      type,
      module: 'data',
      entity,
      action,
      resourceId: resourceId ?? null
    });
  }
}

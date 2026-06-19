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
  constructor(private readonly dataCenterService: DataCenterService) {}

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
  createBackupJob(@Body() dto: CreateBackupJobInput, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.createBackupJob(dto, operator);
  }

  @Patch('backup-jobs/:id/status')
  @RequirePermissions('data.backup.create')
  updateBackupJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBackupJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.updateBackupJobStatus(id, dto, operator);
  }

  @Post('backup-jobs/:id/execute')
  @RequirePermissions('data.backup.create')
  executeBackupJob(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.executeBackupJob(id, operator);
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
  createRestoreJob(
    @Body() dto: CreateRestoreJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.createRestoreJob(dto, operator);
  }

  @Patch('restore-jobs/:id/status')
  @RequirePermissions('data.restore.create')
  updateRestoreJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.updateRestoreJobStatus(id, dto, operator);
  }

  @Post('restore-jobs/:id/execute')
  @RequirePermissions('data.restore.create')
  executeRestoreJob(
    @Param('id') id: string,
    @Body() dto: ExecuteRestoreJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.executeRestoreJob(id, dto, operator);
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
  createImportJob(@Body() dto: CreateImportJobInput, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.createImportJob(dto, operator);
  }

  @Patch('import-jobs/:id/status')
  @RequirePermissions('data.import.create')
  updateImportJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.updateImportJobStatus(id, dto, operator);
  }

  @Post('import-jobs/:id/execute')
  @RequirePermissions('data.import.create')
  executeImportJob(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.executeImportJob(id, operator);
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
  createExportJob(@Body() dto: CreateExportJobInput, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.createExportJob(dto, operator);
  }

  @Patch('export-jobs/:id/status')
  @RequirePermissions('data.export.create')
  updateExportJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.updateExportJobStatus(id, dto, operator);
  }

  @Post('export-jobs/:id/execute')
  @RequirePermissions('data.export.create')
  executeExportJob(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.executeExportJob(id, operator);
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
  restoreRecycleBinRecord(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.restoreRecycleBinRecord(id, operator);
  }

  @Delete('recycle-bin/:id')
  @RequirePermissions('data.recycle_bin.restore')
  purgeRecycleBinRecord(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.dataCenterService.purgeRecycleBinRecord(id, operator);
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
  createCleanupJob(
    @Body() dto: CreateCleanupJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.createCleanupJob(dto, operator);
  }

  @Patch('cleanup-jobs/:id/status')
  @RequirePermissions('data.cleanup.manage')
  updateCleanupJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.updateCleanupJobStatus(id, dto, operator);
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
  createDuplicateMergeJob(
    @Body() dto: CreateDuplicateMergeJobInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.createDuplicateMergeJob(dto, operator);
  }

  @Patch('duplicate-merge-jobs/:id/status')
  @RequirePermissions('data.duplicate_merge.manage')
  updateDuplicateMergeJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGenericJobStatusInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.updateDuplicateMergeJobStatus(id, dto, operator);
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
  createDictionary(
    @Body() dto: CreateDataDictionaryInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.createDictionary(dto, operator);
  }

  @Patch('dictionaries/:id')
  @RequirePermissions('data.dictionary.manage')
  updateDictionary(
    @Param('id') id: string,
    @Body() dto: UpdateDataDictionaryInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.updateDictionary(id, dto, operator);
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
  saveSystemParameter(
    @Param('key') key: string,
    @Body() dto: SaveSystemParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.dataCenterService.saveSystemParameter(key, dto, operator);
  }

  private buildContentDisposition(fileName: string) {
    const fallbackName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`;
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AttachmentsService } from './attachments.service';
import type { CreateAttachmentMetadataDto } from './dto/create-attachment-metadata.dto';
import type { UploadedFile as UploadedAttachmentFile } from './attachments.types';

const uploadDirectory = resolve(process.cwd(), process.env.ATTACHMENT_STORAGE_DIR ?? 'uploads');
mkdirSync(uploadDirectory, { recursive: true });

interface DownloadResponse {
  setHeader(name: string, value: string): void;
}

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  @RequirePermissions('attachment.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('businessModule') businessModule?: string,
    @Query('objectType') objectType?: string,
    @Query('objectId') objectId?: string,
    @Query('purpose') purpose?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.attachmentsService.list({
      page,
      pageSize,
      keyword,
      businessModule,
      objectType,
      objectId,
      purpose,
      sortBy,
      sortOrder
    });
  }

  @Post()
  @RequirePermissions('attachment.upload')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: uploadDirectory,
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    })
  )
  upload(
    @UploadedFile() file: UploadedAttachmentFile | undefined,
    @Body() metadata: CreateAttachmentMetadataDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    return this.attachmentsService.createWithMetadata(file, metadata, operator);
  }

  @Get(':id')
  @RequirePermissions('attachment.view')
  get(@Param('id') id: string) {
    return this.attachmentsService.get(id);
  }

  @Get(':id/download')
  @RequirePermissions('attachment.download')
  async download(
    @Param('id') id: string,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Res({ passthrough: true }) response: DownloadResponse
  ) {
    const attachment = await this.attachmentsService.recordDownload(id, operator);
    const filePath = resolve(uploadDirectory, attachment.storageKey);

    if (!filePath.startsWith(`${uploadDirectory}${sep}`) || !existsSync(filePath)) {
      throw new NotFoundException('Attachment file not found');
    }

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      this.buildContentDisposition(attachment.originalName)
    );

    return new StreamableFile(createReadStream(filePath));
  }

  private buildContentDisposition(fileName: string) {
    const fallbackName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`;
  }
}

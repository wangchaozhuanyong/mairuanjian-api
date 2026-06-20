import { BadRequestException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SourcePlatformsService } from './source-platforms.service';

describe('SourcePlatformsService', () => {
  it('requires source platform name', async () => {
    const service = new SourcePlatformsService({} as PrismaService, {} as AuditLogsService);

    await expect(service.create({ name: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

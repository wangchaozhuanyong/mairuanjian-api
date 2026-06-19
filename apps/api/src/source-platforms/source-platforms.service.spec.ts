import { BadRequestException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SourcePlatformsService } from './source-platforms.service';

describe('SourcePlatformsService', () => {
  it('rejects invalid source platform code', async () => {
    const service = new SourcePlatformsService({} as PrismaService, {} as AuditLogsService);

    await expect(service.create({ name: '淘宝', code: 'taobao 店铺' })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

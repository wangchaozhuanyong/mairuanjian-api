import { BadRequestException } from '@nestjs/common';
import { AppleAccountsService } from '../apple-accounts/apple-accounts.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleAccountSourceChannelsService } from './apple-account-source-channels.service';

describe('AppleAccountSourceChannelsService', () => {
  it('requires source channel name', async () => {
    const service = new AppleAccountSourceChannelsService(
      {} as PrismaService,
      {} as AuditLogsService,
      {} as AppleAccountsService
    );

    await expect(service.create({ name: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

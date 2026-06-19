import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/auth.decorators';
import { PrismaService } from './common/prisma/prisma.service';

@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  live() {
    return {
      status: 'ok'
    };
  }

  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is not ready');
    }

    return {
      status: 'ready',
      database: 'ok'
    };
  }
}

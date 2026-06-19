import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppleActivationsController } from './apple-activations.controller';
import { AppleActivationsService } from './apple-activations.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppleActivationsController],
  providers: [AppleActivationsService]
})
export class AppleActivationsModule {}

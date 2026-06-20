import { Controller, Header, Sse, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SkipApiResponse } from '../common/interceptors/skip-api-response.decorator';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('events')
  @SkipApiResponse()
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  events(@CurrentUser() user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('请先登录后再连接实时事件。');
    }

    return this.realtimeService.streamFor(user);
  }
}

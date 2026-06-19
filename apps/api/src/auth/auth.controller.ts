import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { CurrentUser, Public } from './auth.decorators';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import type { LoginDto } from './dto/login.dto';

interface RequestWithMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: RequestWithMeta) {
    return this.authService.login(dto, {
      ip: request.ip,
      userAgent: this.getHeaderValue(request.headers['user-agent'])
    });
  }

  @Post('logout')
  logout() {
    return {
      loggedOut: true
    };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('refresh')
  refresh(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.refresh(user);
  }

  private getHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value.join(', ') : value;
  }
}

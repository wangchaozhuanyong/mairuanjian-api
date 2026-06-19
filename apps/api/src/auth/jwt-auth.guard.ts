import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SecurityService } from '../security/security.service';
import { UsersService } from '../users/users.service';
import { IS_PUBLIC_KEY } from './auth.decorators';
import type { AuthenticatedUser, JwtPayload } from './auth.types';

interface RequestWithAuthHeader {
  headers: {
    authorization?: string;
  };
  ip?: string;
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly securityService: SecurityService
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuthHeader>();
    const token = this.extractToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const active = await this.securityService.isAccessTokenActive(token);
      if (!active) {
        throw new UnauthorizedException('Session has expired or been revoked');
      }

      const ipAllowed = await this.securityService.isRequestIpAllowed(request.ip, ['admin', 'api']);
      if (!ipAllowed) {
        throw new ForbiddenException('IP address is not allowed');
      }

      request.user = await this.usersService.getAuthenticatedUser(payload.sub);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { UsersService } from '../users/users.service';
import { verifyPassword } from './password-hasher';
import type { AuthenticatedUser, JwtPayload } from './auth.types';
import type { LoginDto } from './dto/login.dto';

interface LoginRequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly auditLogsService: AuditLogsService,
    private readonly securityService: SecurityService
  ) {}

  async login(dto: LoginDto, requestMeta?: LoginRequestMeta) {
    const user = await this.prisma.user.findFirst({
      where: {
        username: dto.username,
        deletedAt: null
      }
    });

    if (!user || user.status !== 'active') {
      await this.securityService.recordLoginAttempt({
        username: dto.username,
        userId: user?.id ?? null,
        status: user ? 'blocked' : 'failed',
        failureReason: user ? `user_status_${user.status}` : 'user_not_found',
        ip: requestMeta?.ip,
        userAgent: requestMeta?.userAgent
      });
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.securityService.recordLoginAttempt({
        username: dto.username,
        userId: user.id,
        status: 'failed',
        failureReason: 'password_invalid',
        ip: requestMeta?.ip,
        userAgent: requestMeta?.userAgent
      });
      throw new UnauthorizedException('Invalid username or password');
    }

    const authenticatedUser = await this.usersService.getAuthenticatedUser(user.id);
    const mfaRequired = await this.securityService.isMfaRequiredForUser(authenticatedUser);
    if (mfaRequired) {
      const mfaCode = dto.mfaCode?.trim();
      if (!mfaCode) {
        await this.securityService.recordLoginAttempt({
          username: dto.username,
          userId: user.id,
          status: 'blocked',
          failureReason: 'mfa_required',
          ip: requestMeta?.ip,
          userAgent: requestMeta?.userAgent
        });
        throw new UnauthorizedException('MFA code is required');
      }

      try {
        await this.securityService.verifyUserMfaCode(user.id, mfaCode);
      } catch {
        await this.securityService.recordLoginAttempt({
          username: dto.username,
          userId: user.id,
          status: 'blocked',
          failureReason: 'mfa_invalid',
          ip: requestMeta?.ip,
          userAgent: requestMeta?.userAgent
        });
        throw new UnauthorizedException('MFA code is invalid');
      }
    }

    await this.prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        lastLoginAt: new Date()
      }
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'auth',
      action: 'login',
      objectType: 'user',
      objectId: user.id,
      remark: 'User logged in'
    });

    const response = this.createAuthResponse(authenticatedUser);
    await this.securityService.recordLoginAttempt({
      username: user.username,
      userId: user.id,
      status: 'success',
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent
    });
    await this.securityService.createActiveSession({
      userId: user.id,
      accessToken: response.accessToken,
      expiresAt: this.getTokenExpiresAt(response.accessToken),
      ip: requestMeta?.ip,
      userAgent: requestMeta?.userAgent
    });

    return response;
  }

  async refresh(user: AuthenticatedUser) {
    return this.createAuthResponse(user);
  }

  private createAuthResponse(user: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user
    };
  }

  private getTokenExpiresAt(accessToken: string) {
    const payloadPart = accessToken.split('.')[1];
    if (!payloadPart) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as {
        exp?: number;
      };
      return payload.exp
        ? new Date(payload.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } catch {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}

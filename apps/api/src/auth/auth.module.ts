import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type ms from 'ms';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecurityModule } from '../security/security.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as ms.StringValue;

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-jwt-secret',
      signOptions: {
        expiresIn: jwtExpiresIn
      }
    }),
    UsersModule,
    AuditLogsModule,
    NotificationsModule,
    SecurityModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PermissionsGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    }
  ],
  exports: [JwtAuthGuard, PermissionsGuard]
})
export class AuthModule {}

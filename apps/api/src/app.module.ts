import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppleAccountsModule } from './apple-accounts/apple-accounts.module';
import { AppleAccountStatusChecksModule } from './apple-account-status-checks/apple-account-status-checks.module';
import { AppleAccountSourceChannelsModule } from './apple-account-source-channels/apple-account-source-channels.module';
import { AppleActionPlansModule } from './apple-action-plans/apple-action-plans.module';
import { AppleActivationsModule } from './apple-activations/apple-activations.module';
import { AppleAutomationTasksModule } from './apple-automation-tasks/apple-automation-tasks.module';
import { AppleBalancesModule } from './apple-balances/apple-balances.module';
import { AppleOfficialPricesModule } from './apple-official-prices/apple-official-prices.module';
import { AppleOrdersModule } from './apple-orders/apple-orders.module';
import { AppleReportsModule } from './apple-reports/apple-reports.module';
import { AppleRenewalTasksModule } from './apple-renewal-tasks/apple-renewal-tasks.module';
import { AppleServicesModule } from './apple-services/apple-services.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { SensitiveActionAuditInterceptor } from './audit-logs/sensitive-action-audit.interceptor';
import { AuthModule } from './auth/auth.module';
import { CodeOrdersModule } from './code-orders/code-orders.module';
import { CodeAfterSalesModule } from './code-after-sales/code-after-sales.module';
import { CodeReportsModule } from './code-reports/code-reports.module';
import { CodeServicesModule } from './code-services/code-services.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/env.validation';
import { CustomersModule } from './customers/customers.module';
import { DataCenterModule } from './data-center/data-center.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MessageTemplatesModule } from './message-templates/message-templates.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OpsModule } from './ops/ops.module';
import { RedeemCodesModule } from './redeem-codes/redeem-codes.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RolesModule } from './roles/roles.module';
import { SecurityModule } from './security/security.module';
import { SourcePlatformsModule } from './source-platforms/source-platforms.module';
import { UserTableViewsModule } from './user-table-views/user-table-views.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv
    }),
    AuthModule,
    AppleAccountSourceChannelsModule,
    AppleAccountsModule,
    AppleAccountStatusChecksModule,
    AppleActionPlansModule,
    AppleActivationsModule,
    AppleAutomationTasksModule,
    AppleBalancesModule,
    AppleOfficialPricesModule,
    AppleReportsModule,
    AppleRenewalTasksModule,
    AppleServicesModule,
    AppleOrdersModule,
    AuditLogsModule,
    AttachmentsModule,
    CustomersModule,
    DataCenterModule,
    MaintenanceModule,
    SourcePlatformsModule,
    MessageTemplatesModule,
    NotificationsModule,
    OpsModule,
    CodeAfterSalesModule,
    CodeOrdersModule,
    CodeReportsModule,
    CodeServicesModule,
    RedeemCodesModule,
    RealtimeModule,
    RolesModule,
    SecurityModule,
    UsersModule,
    UserTableViewsModule,
    PrismaModule
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SensitiveActionAuditInterceptor
    }
  ]
})
export class AppModule {}

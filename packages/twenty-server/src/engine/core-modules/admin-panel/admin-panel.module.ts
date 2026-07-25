import { Module, forwardRef } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreEntityCacheModule } from 'src/engine/core-entity-cache/core-entity-cache.module';
import { AdminPanelApplicationRegistrationResolver } from 'src/engine/core-modules/admin-panel/admin-panel-application-registration.resolver';
import { AdminPanelArxResolver } from 'src/engine/core-modules/admin-panel/admin-panel-arx.resolver';
import { AdminPanelHealthService } from 'src/engine/core-modules/admin-panel/admin-panel-health.service';
import { AdminPanelQueueService } from 'src/engine/core-modules/admin-panel/admin-panel-queue.service';
import { AdminPanelResolver } from 'src/engine/core-modules/admin-panel/admin-panel.resolver';
import { AppHealthIndicator } from 'src/engine/core-modules/admin-panel/indicators/app.health';
import { ConnectedAccountHealth } from 'src/engine/core-modules/admin-panel/indicators/connected-account.health';
import { DatabaseHealthIndicator } from 'src/engine/core-modules/admin-panel/indicators/database.health';
import { RedisHealthIndicator } from 'src/engine/core-modules/admin-panel/indicators/redis.health';
import { WorkerHealthIndicator } from 'src/engine/core-modules/admin-panel/indicators/worker.health';
import { MaintenanceModeService } from 'src/engine/core-modules/admin-panel/maintenance-mode.service';
import { AdminPanelArxService } from 'src/engine/core-modules/admin-panel/services/admin-panel-arx.service';
import { AdminPanelBillingService } from 'src/engine/core-modules/admin-panel/services/admin-panel-billing.service';
import { AdminPanelChatService } from 'src/engine/core-modules/admin-panel/services/admin-panel-chat.service';
import { AdminPanelConfigService } from 'src/engine/core-modules/admin-panel/services/admin-panel-config.service';
import { AdminPanelServerAdminService } from 'src/engine/core-modules/admin-panel/services/admin-panel-server-admin.service';
import { AdminPanelSigningKeyService } from 'src/engine/core-modules/admin-panel/services/admin-panel-signing-key.service';
import { AdminPanelStatisticsService } from 'src/engine/core-modules/admin-panel/services/admin-panel-statistics.service';
import { AdminPanelUserLookupService } from 'src/engine/core-modules/admin-panel/services/admin-panel-user-lookup.service';
import { AdminPanelVersionService } from 'src/engine/core-modules/admin-panel/services/admin-panel-version.service';
import { ApplicationRegistrationModule } from 'src/engine/core-modules/application/application-registration/application-registration.module';
import { ArxChatAgentModule } from 'src/engine/core-modules/arx-chat/arx-chat-agent.module';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { BillingCustomerEntity } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { BillingPriceEntity } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { WorkspaceDomainsModule } from 'src/engine/core-modules/domain/workspace-domains/workspace-domains.module';
import { EventLogEmitterModule } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.module';
import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { FileModule } from 'src/engine/core-modules/file/file.module';
import { ImpersonationModule } from 'src/engine/core-modules/impersonation/impersonation.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { KeyValuePairModule } from 'src/engine/core-modules/key-value-pair/key-value-pair.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { MetricsModule } from 'src/engine/core-modules/metrics/metrics.module';
import { OrgChartClientIpModule } from 'src/engine/core-modules/org-chart/org-chart-client-ip.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';
import { TelemetryModule } from 'src/engine/core-modules/telemetry/telemetry.module';
import { TwoFactorAuthenticationModule } from 'src/engine/core-modules/two-factor-authentication/two-factor-authentication.module';
import { UpgradeModule } from 'src/engine/core-modules/upgrade/upgrade.module';
import { UsageModule } from 'src/engine/core-modules/usage/usage.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserVarsModule } from 'src/engine/core-modules/user/user-vars/user-vars.module';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserModule } from 'src/engine/core-modules/user/user.module';
import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AgentMessageEntity } from 'src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message.entity';
import { AgentChatThreadEntity } from 'src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      WorkspaceEntity,
      UserWorkspaceEntity,
      FeatureFlagEntity,
      AgentChatThreadEntity,
      AgentMessageEntity,
      BillingCustomerEntity,
      BillingPriceEntity,
      WorkspaceCredits,
    ]),
    AuthModule,
    BillingModule,
    FileModule,
    WorkspaceDomainsModule,
    RedisClientModule,
    TerminusModule,
    MetricsModule,
    FeatureFlagModule,
    TelemetryModule,
    ImpersonationModule,
    PermissionsModule,
    SecureHttpClientModule,
    ApplicationRegistrationModule,
    UsageModule,
    KeyValuePairModule,
    UserVarsModule,
    UpgradeModule,
    UserModule,
    JwtModule,
    CoreEntityCacheModule,
    EventLogEmitterModule,
    TwoFactorAuthenticationModule,
    WorkspaceModule,
    OrgChartClientIpModule,
    LinkedInSearchModule,
    forwardRef(() => OrgChartModule),
    forwardRef(() => UnipilePoolModule),
    forwardRef(() => ArxChatAgentModule),
  ],
  providers: [
    AdminPanelResolver,
    AdminPanelArxResolver,
    AdminPanelApplicationRegistrationResolver,
    AdminPanelArxService,
    AdminPanelUserLookupService,
    AdminPanelServerAdminService,
    AdminPanelStatisticsService,
    AdminPanelBillingService,
    AdminPanelChatService,
    AdminPanelConfigService,
    AdminPanelSigningKeyService,
    AdminPanelVersionService,
    AdminPanelHealthService,
    AdminPanelQueueService,
    MaintenanceModeService,
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    WorkerHealthIndicator,
    ConnectedAccountHealth,
    AppHealthIndicator,
    provideWorkspaceScopedRepository(AgentMessageEntity),
    provideWorkspaceScopedRepository(FeatureFlagEntity),
    provideWorkspaceScopedRepository(BillingCustomerEntity),
  ],
  exports: [
    AdminPanelUserLookupService,
    AdminPanelStatisticsService,
    AdminPanelChatService,
    AdminPanelConfigService,
    AdminPanelVersionService,
    MaintenanceModeService,
  ],
})
export class AdminPanelModule {}

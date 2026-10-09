/* @license Enterprise */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClickHouseModule } from 'src/database/clickHouse/clickHouse.module';
import { EventLogEmitterModule } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { UsageEventRetryJob } from 'src/engine/core-modules/usage/jobs/usage-event-retry.job';
import { UsageEventListener } from 'src/engine/core-modules/usage/listeners/usage-event.listener';
import { UsageAnalyticsService } from 'src/engine/core-modules/usage/services/usage-analytics.service';
import { UsageLedgerHealthService } from 'src/engine/core-modules/usage/services/usage-ledger-health.service';
import { UsageResolver } from 'src/engine/core-modules/usage/usage.resolver';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';

@Module({
  imports: [
    ClickHouseModule,
    EventLogEmitterModule,
    FeatureFlagModule,
    PermissionsModule,
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
  ],
  providers: [
    UsageResolver,
    UsageAnalyticsService,
    UsageEventListener,
    UsageEventRetryJob,
    UsageLedgerHealthService,
  ],
  exports: [UsageAnalyticsService],
})
export class UsageModule {}

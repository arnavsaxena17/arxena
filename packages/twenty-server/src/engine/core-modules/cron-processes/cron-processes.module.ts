import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceResolverBuilderModule } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { SharedCronOperationsService } from 'src/engine/core-modules/cron-processes/services/shared-cron-operations.service';
import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { EngagedCandidateProcessor } from '../arx-chat/services/candidate-engagement/engaged-candidate-processor.job';
import { UnipilePoolModule } from '../arx-chat/unipile-pool.module';
import { CandidateEngagementCronService } from './services/candidate-engagement-cron.service';
import { CandidateStatusClassificationCronService } from './services/candidate-status-classification-cron.service';
import { LinkedinSockIncomingMessageFetchingCronService } from './services/linkedin-sock-message-cron.service';

@Module({
  imports: [
    ApiKeyModule,
    CoreGraphQLApiModule,
    WebSocketModule,
    DataSourceModule,
    WorkspaceSchemaBuilderModule,
    FeatureFlagModule,
    WorkspaceResolverBuilderModule,
    AuthModule,
    GraphQLExecutionModule,
    WorkspaceModificationsModule,
    JwtModule,
    TypeORMModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([WorkspaceEntity]),
    TypeOrmModule.forFeature([DataSourceEntity]),
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([AppTokenEntity]),
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
    TypeOrmModule.forFeature([WorkspaceEntity, FeatureFlagEntity]),
    MessageQueueModule,
    UnipilePoolModule,
    WorkspaceDataSourceModule,
    WorkspaceCacheStorageModule,
  ],
  providers: [
    SharedCronOperationsService,
    CandidateEngagementCronService,
    CandidateStatusClassificationCronService,
    EngagedCandidateProcessor,
    LinkedinSockIncomingMessageFetchingCronService,
  ],
  exports: [
    CandidateEngagementCronService,
    CandidateStatusClassificationCronService,
    LinkedinSockIncomingMessageFetchingCronService,
  ],
})
export class CronProcessesModule {}

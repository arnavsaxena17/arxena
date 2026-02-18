import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { FeatureFlag } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceResolverBuilderModule } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { SharedCronOperationsService } from 'src/engine/core-modules/cron-processes/services/shared-cron-operations.service';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
// import { WhiskeySocketsBaileysWhatsappModule } from 'src/engine/core-modules/whiskeysocket-baileys/whiskeysocket-baileys.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceMetadataCacheModule } from 'src/engine/metadata-modules/workspace-metadata-cache/workspace-metadata-cache.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { EngagedCandidateProcessor } from '../arx-chat/services/candidate-engagement/engaged-candidate-processor.job';
import { ApiKeyService } from '../auth/services/api-key.service';
import { MessageQueueModule } from '../message-queue/message-queue.module';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { CandidateEngagementCronService } from './services/candidate-engagement-cron.service';
import { CandidateStatusClassificationCronService } from './services/candidate-status-classification-cron.service';
import { LinkedinSockIncomingMessageFetchingCronService } from './services/linkedin-sock-message-cron.service';
// import { WorkspaceMemberCleanupCronService } from './services/workspace-member-cleanup-cron.service';


const isWorker = process.argv[1]?.includes('queue-worker');

const conditionalImports = isWorker
  ? [MessageQueueModule]
  : [];



@Module({
  imports: [
    CoreGraphQLApiModule,
    WebSocketModule,
    DataSourceModule, 
    WorkspaceSchemaBuilderModule,
    FeatureFlagModule,
    WorkspaceResolverBuilderModule,
    WorkspaceMetadataCacheModule,
    AuthModule,     
    GraphQLExecutionModule,
    WorkspaceModificationsModule, 
    JwtModule,
    TypeORMModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    TypeOrmModule.forFeature([Workspace, FeatureFlag], 'core'),
    // WhiskeySocketsBaileysWhatsappModule,
    MessageQueueModule,
  ],
  providers: [
    WorkspaceQueryService,
    WorkspaceDataSourceService,
    WorkspaceCacheStorageService,
    ApiKeyService,
    SharedCronOperationsService,
    CandidateEngagementCronService,
    CandidateStatusClassificationCronService,
    EngagedCandidateProcessor,
    LinkedinSockIncomingMessageFetchingCronService,
    // WorkspaceMemberCleanupCronService,
  ],
  exports: [
    CandidateEngagementCronService,
    CandidateStatusClassificationCronService,
    LinkedinSockIncomingMessageFetchingCronService,
    // WorkspaceMemberCleanupCronService,
  ],
})
export class CronProcessesModule {} 
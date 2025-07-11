import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { TwilioControllers } from 'src/engine/core-modules/arx-chat/controllers/twilio-api.controller';
// import { WhatsappControllers } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-api.controller';
import { ArxChatEndpoint } from 'src/engine/core-modules/arx-chat/controllers/arx-chat-agent.controller';
import { GoogleControllers } from 'src/engine/core-modules/arx-chat/controllers/google-calendar-mail-api.controller';
import { MetaWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/meta-whatsapp.controller';
import { WhatsappWebhook } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-webhook.controller';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
// import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
// import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/ext-sock-whatsapp.controller';
import { JwtService } from '@nestjs/jwt/dist/jwt.service';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceResolverBuilderModule } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { VideoInterviewProcessController } from 'src/engine/core-modules/arx-chat/controllers/video-interview-process-controller';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.controller';
import { WhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.job';
import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.service';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { JwtAuthStrategy } from 'src/engine/core-modules/auth/strategies/jwt.auth.strategy';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { FeatureFlag } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { GraphQLExecutionService } from 'src/engine/core-modules/graphql/graphql-execution.service';
import { SchemaCacheService } from 'src/engine/core-modules/graphql/services/schema-cache.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module'; // Add this import
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module'; // Add this import
import { WorkspaceMetadataCacheModule } from 'src/engine/metadata-modules/workspace-metadata-cache/workspace-metadata-cache.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { CandidateEngagementArx } from './services/candidate-engagement/candidate-engagement';

const isWorker = process.argv[1]?.includes('queue-worker');

const conditionalImports = isWorker
  ? [ExtSockWhatsappWhitelistProcessingService, WhatsappMessageProcessor]
  : [];


@Module({
  imports: [
    GoogleCalendarModule,
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
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    TypeOrmModule.forFeature([Workspace, FeatureFlag], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
  ],
  controllers: [
    ArxChatEndpoint,
    WhatsappWebhook,
    MetaWhatsappController,
    TwilioControllers,
    GoogleControllers,
    VideoInterviewProcessController,
    ExtSockWhatsappController,
  ],
  providers: [
    PersonService,
    GraphQLExecutionService,
    CandidateService,
    RedisService,
    ExtSockWhatsappMessageProcessor,
    ...conditionalImports,
    ExtSockWhatsappService,
    WorkspaceDataSourceService,
    WorkspaceCacheStorageService,
    ApiKeyService,
    WorkspaceSchemaFactory,
    JwtWrapperService,
    SchemaCacheService,
    JwtService,
    GoogleSheetsService,
    WebSocketGateway,
    ProcessCandidatesService,
    WorkspaceQueryService,
    EnvironmentService,
    JwtAuthStrategy,
    EmailService,
    WebSocketService,
    AccessTokenService,
    CandidateEngagementArx,
  ],
  exports: [ExtSockWhatsappService, CandidateEngagementArx],
})
export class ArxChatAgentModule {}

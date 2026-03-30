import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { JwtAuthStrategy } from 'src/engine/core-modules/auth/strategies/jwt.auth.strategy';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentService } from '../environment/environment.service';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { GraphQLExecutionService } from '../graphql/graphql-execution.service';
import { SchemaCacheService } from '../graphql/services/schema-cache.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { EventsGateway } from './events-gateway-module/events-gateway';
import { WhatsAppMonitoringController } from './whatsapp-monitoring.controller';
import { BaileysWhatsappController } from './whiskeysocket-baileys.controller';
import { BaileysWhatsappService } from './whiskeysocket-baileys.service';

@Module({
  imports: [
    WorkspaceModificationsModule,
    JwtModule,
    AuthModule,
    CoreGraphQLApiModule,
    GraphQLExecutionModule,
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    DataSourceModule,

  ],
  providers: [
    EventsGateway,
    JwtAuthGuard,
    JwtService,
    WebSocketService,
    SchemaCacheService,
    ApiKeyService,
    AccessTokenService,
    JwtAuthStrategy,
    WorkspaceQueryService,
    GraphQLExecutionService,
    WorkspaceDataSourceService,
    EnvironmentService,
    WorkspaceCacheStorageService,
    BaileysWhatsappService,
  ],
  controllers: [BaileysWhatsappController, WhatsAppMonitoringController],
  exports: [BaileysWhatsappService, EventsGateway]
})
export class WhiskeySocketsBaileysWhatsappModule {}

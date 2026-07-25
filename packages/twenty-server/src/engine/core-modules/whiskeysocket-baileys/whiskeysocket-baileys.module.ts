import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { AuthModule } from '../auth/auth.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { EventsGateway } from './events-gateway-module/events-gateway';
import { WhatsAppMonitoringController } from './whatsapp-monitoring.controller';
import { BaileysWhatsappController } from './whiskeysocket-baileys.controller';
import { BaileysWhatsappService } from './whiskeysocket-baileys.service';

@Module({
  imports: [
    WorkspaceCacheStorageModule,
    EnvironmentModule,
    WorkspaceDataSourceModule,
    ApiKeyModule,
    WorkspaceModificationsModule,
    JwtModule,
    AuthModule,
    CoreGraphQLApiModule,
    GraphQLExecutionModule,
    TypeORMModule,
    TypeOrmModule.forFeature([WorkspaceEntity]),
    TypeOrmModule.forFeature([DataSourceEntity]),
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([AppTokenEntity]),
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
    DataSourceModule,

  ],
  providers: [
    EventsGateway,
    WebSocketService,
    BaileysWhatsappService,
  ],
  controllers: [BaileysWhatsappController, WhatsAppMonitoringController],
  exports: [BaileysWhatsappService, EventsGateway]
})
export class WhiskeySocketsBaileysWhatsappModule {}

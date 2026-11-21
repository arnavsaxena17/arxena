import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { GoogleSheetsService } from './google-sheets.service';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { AppTokenEntity } from '../app-token/app-token.entity';
import { AuthModule } from '../auth/auth.module';
import { CandidateDataSourcesModule } from 'src/engine/core-modules/candidate-data-sources/candidate-data-sources.module';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GoogleConnectedAccountAuthModule } from '../google-auth/google-connected-account-auth.module';
import { UserEntity } from '../user/user.entity';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { GoogleSheetsDataController } from './google-sheet-data.controller';
import { GoogleSheetsController } from './google-sheets.controller';
import { MeteredLlmModule } from 'src/engine/core-modules/metered-llm/metered-llm.module';

@Module({
  imports: [
    MeteredLlmModule,
    WebSocketModule,
    EmailModule,
    EnvironmentModule,
    WorkspaceDataSourceModule,
    ApiKeyModule,
    CandidateSourcingModule,
    CandidateDataSourcesModule,
    CoreGraphQLApiModule,
    DataSourceModule,
    AuthModule,
    WorkspaceModificationsModule,
    GraphQLExecutionModule,
    GoogleConnectedAccountAuthModule,

    JwtModule,
    TypeORMModule,
    TypeOrmModule.forFeature([WorkspaceEntity]),
    TypeOrmModule.forFeature([DataSourceEntity]),
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([AppTokenEntity]),
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
  ],
  providers: [GoogleSheetsService],
  controllers: [GoogleSheetsController, GoogleSheetsDataController],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}

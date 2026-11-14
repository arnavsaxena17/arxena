import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { GoogleSheetsService } from './google-sheets.service';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { DataSourceTransformerFactoryService } from 'src/domains/ingestion/candidate-sourcing/services/data-source-transformer-factory.service';
import { ApnaDatabaseTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/apna-database-transformer.service';
import { HiringNaukriTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-recruiter-jobs-transformer.service';
import { NaukriProfileDataTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/naukri-profile-data-transformer.service';
import { ResdexNaukriTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/resdex-naukri-transformer.service';
import { RmsNaukriTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/rms-naukri-transformer.service';
import { SpreadsheetImportTwentyTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/spreadsheet-import-twenty-transformer.service';
import { UploadedProfilesTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/uploaded-profiles-transformer.service';
import { DataProcessingUtils } from 'src/domains/ingestion/candidate-sourcing/utils/data-processing.utils';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { AppTokenEntity } from '../app-token/app-token.entity';
import { AuthModule } from '../auth/auth.module';
import { CandidateSourcingModule } from 'src/domains/ingestion/candidate-sourcing/candidate-sourcing.module';
import { ProcessAiFiltersService } from 'src/domains/ingestion/candidate-sourcing/jobs/process-ai-filters.service';
import { ProcessCandidatesService } from 'src/domains/ingestion/candidate-sourcing/jobs/process-candidates.service';
import { AiFilteringService } from 'src/domains/ingestion/candidate-sourcing/services/ai-filtering.service';
import { CandidateDataService } from 'src/domains/ingestion/candidate-sourcing/services/candidate-data.service';
import { CandidateService } from 'src/domains/ingestion/candidate-sourcing/services/candidate.service';
import { ChatService } from 'src/domains/ingestion/candidate-sourcing/services/chat.service';
import { FilterDescriptionProcessorService } from 'src/domains/ingestion/candidate-sourcing/services/filter-description-processor.service';
import { PersonService } from 'src/domains/ingestion/candidate-sourcing/services/person.service';
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
    forwardRef(() => CandidateSourcingModule),
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
  providers: [
    GoogleSheetsService,
    PersonService,
    ProcessCandidatesService,
    CandidateService,
    ChatService,
    FilterDescriptionProcessorService,
    AiFilteringService,
    CandidateDataService,
    DataSourceTransformerFactoryService,
    ResdexNaukriTransformerService,
    HiringNaukriTransformerService,
    LinkedinPremiumTransformerService,
    SpreadsheetImportTwentyTransformerService,
    RmsNaukriTransformerService,
    ApnaDatabaseTransformerService,
    NaukriProfileDataTransformerService,
    ProcessAiFiltersService,
    UploadedProfilesTransformerService,
    LinkedinRecruiterJobsTransformerService,
    LinkedinPremiumJobsTransformerService,
    DataProcessingUtils,
  ],
  controllers: [GoogleSheetsController, GoogleSheetsDataController],
  exports: [GoogleSheetsService, PersonService, CandidateService, ChatService, ProcessCandidatesService],
})
export class GoogleSheetsModule {}

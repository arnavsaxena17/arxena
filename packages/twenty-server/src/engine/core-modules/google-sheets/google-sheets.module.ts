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
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
import { ApnaDatabaseTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/apna-database-transformer.service';
import { HiringNaukriTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-recruiter-jobs-transformer.service';
import { NaukriProfileDataTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/naukri-profile-data-transformer.service';
import { ResdexNaukriTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/resdex-naukri-transformer.service';
import { RmsNaukriTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/rms-naukri-transformer.service';
import { SpreadsheetImportTwentyTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/spreadsheet-import-twenty-transformer.service';
import { UploadedProfilesTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/uploaded-profiles-transformer.service';
import { DataProcessingUtils } from 'src/engine/core-modules/candidate-sourcing/utils/data-processing.utils';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { AppTokenEntity } from '../app-token/app-token.entity';
import { AuthModule } from '../auth/auth.module';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { DeleteFieldValuesService } from '../candidate-sourcing/jobs/delete-field-values.service';
import { ProcessAiFiltersService } from '../candidate-sourcing/jobs/process-ai-filters.service';
import { ProcessCandidatesService } from '../candidate-sourcing/jobs/process-candidates.service';
import { AiFilteringProcessorService } from '../candidate-sourcing/services/ai-filtering-processor.service';
import { AiFilteringService } from '../candidate-sourcing/services/ai-filtering.service';
import { CandidateDataService } from '../candidate-sourcing/services/candidate-data.service';
import { CandidateService } from '../candidate-sourcing/services/candidate.service';
import { ChatService } from '../candidate-sourcing/services/chat.service';
import { FilterDescriptionProcessorService } from '../candidate-sourcing/services/filter-description-processor.service';
import { PersonService } from '../candidate-sourcing/services/person.service';
import { UserEntity } from '../user/user.entity';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { GoogleSheetsDataController } from './google-sheet-data.controller';
import { GoogleSheetsController } from './google-sheets.controller';

@Module({
  imports: [
    WebSocketModule,
    EmailModule,
    EnvironmentModule,
    WorkspaceDataSourceModule,
    ApiKeyModule,
    CandidateSourcingModule,
    CoreGraphQLApiModule,
    DataSourceModule,
    AuthModule,
    WorkspaceModificationsModule,
    GraphQLExecutionModule,

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
    AiFilteringProcessorService,
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
    DeleteFieldValuesService,
    UploadedProfilesTransformerService,
    LinkedinRecruiterJobsTransformerService,
    LinkedinPremiumJobsTransformerService,
    DataProcessingUtils,
  ],
  controllers: [GoogleSheetsController, GoogleSheetsDataController],
  exports: [GoogleSheetsService, PersonService, CandidateService, ChatService, ProcessCandidatesService],
})
export class GoogleSheetsModule {}

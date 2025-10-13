import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { SearchPlanChatController } from 'src/engine/core-modules/candidate-search/controllers/search-plan-chat.controller';
import { CandidateSearchPromptService } from 'src/engine/core-modules/candidate-search/services/candidate-search-prompt.service';
import { CandidateSearchService } from 'src/engine/core-modules/candidate-search/services/candidate-search.service';
import { SearchPlanAIService } from 'src/engine/core-modules/candidate-search/services/search-plan-ai.service';
import { SearchStrategyExecutorService } from 'src/engine/core-modules/candidate-search/services/search-strategy-executor.service';
import { FileUtils, LinkedinParameterResolver, ParameterSanitizer } from 'src/engine/core-modules/candidate-search/utils';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { FilterDescriptionProcessorService } from 'src/engine/core-modules/candidate-sourcing/services/filter-description-processor.service';
import { JDParserService } from 'src/engine/core-modules/candidate-sourcing/services/jd-parser.service';
import { JDUploadService } from 'src/engine/core-modules/candidate-sourcing/services/jd-upload.service';
import { ResumeReaderService } from 'src/engine/core-modules/candidate-sourcing/services/resume-reader.service';
import { LinkedInSearchController } from 'src/engine/core-modules/linkedin-search/controllers/linkedin-search.controller';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentModule } from '../environment/environment.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';

@Module({
  imports: [EnvironmentModule, WorkspaceModificationsModule, GraphQLExecutionModule,AuthModule ,
    WorkspaceModificationsModule,
    JwtModule,
    AuthModule,
    CandidateSourcingModule,
    CoreGraphQLApiModule,
    GraphQLExecutionModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    ],
  controllers: [LinkedInSearchController, SearchPlanChatController],
  providers: [LinkedInSearchService, 
    LinkedInSessionTrackerService,
    FilterDescriptionProcessorService,
    CandidateSearchService,
    LinkedinParameterResolver,
    FileUtils,
    CandidateSearchPromptService,
    JDParserService,
    ParameterSanitizer,
    ResumeReaderService,
    JDUploadService,
    WorkspaceCacheStorageService,
    SearchPlanAIService,
    SearchStrategyExecutorService],
  exports: [LinkedInSearchService, LinkedInSessionTrackerService],
})
export class LinkedInSearchModule {}

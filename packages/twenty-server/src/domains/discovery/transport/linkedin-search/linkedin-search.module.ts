import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountRateLimitModule } from 'src/engine/core-modules/account-rate-limit/account-rate-limit.module';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
import { SearchParametersPrompts } from 'src/domains/planning/candidate-search/prompts/search-parameters-prompts';
import { JobDescriptionService } from 'src/domains/planning/candidate-search/services/job-description.service';
import { StreamProcessingService } from 'src/engine/core-modules/llm-chat-model/services/stream-processing.service';
import {
  FileUtils,
  LinkedinParameterResolver,
  ParameterSanitizer,
} from 'src/domains/planning/candidate-search/utils';
import { CandidateSourcingModule } from 'src/domains/ingestion/candidate-sourcing/candidate-sourcing.module';
import { FilterDescriptionProcessorService } from 'src/domains/ingestion/candidate-sourcing/services/filter-description-processor.service';
import { JDParserService } from 'src/domains/ingestion/candidate-sourcing/services/jd-parser.service';
import { LinkedInSearchController } from 'src/domains/discovery/transport/linkedin-search/controllers/linkedin-search.controller';
import { LinkedInHtmlParserService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-html-parser.service';
import { LinkedInSearchService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-search.service';
import { LinkedinParameterCatalogService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-parameter-catalog.service';
import { LinkedInSessionTrackerService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-session-tracker.service';
import { UnipileSearchAccountResolver } from 'src/domains/discovery/transport/linkedin-search/services/unipile-search-account.resolver';
import { UnipileV2AccountResolver } from 'src/domains/discovery/transport/linkedin-search/services/unipile-v2-account.resolver';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';

import { ApifyModule } from 'src/domains/discovery/providers/apify/apify.module';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { MeteredLlmModule } from 'src/engine/core-modules/metered-llm/metered-llm.module';

@Module({
  imports: [
    MeteredLlmModule,
    EnvironmentModule,
    AccountRateLimitModule,
    ApifyModule,
    WorkspaceModificationsModule,
    UnipilePoolModule,
    GraphQLExecutionModule,
    AuthModule,
    JwtModule,
    forwardRef(() => CandidateSourcingModule),
    CoreGraphQLApiModule,
    TypeORMModule,
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      UserEntity,
      UserWorkspaceEntity,
      AppTokenEntity,
    ]),
    TypeOrmModule.forFeature([DataSourceEntity]),
  ],
  controllers: [LinkedInSearchController],
  providers: [
    LinkedInSearchService,
    UnipileV2AccountResolver,
    UnipileSearchAccountResolver,
    LinkedInSessionTrackerService,
    LinkedInHtmlParserService,
    FilterDescriptionProcessorService,
    StreamProcessingService,
    LinkedinParameterResolver,
    LinkedinParameterCatalogService,
    SearchParametersPrompts,
    JobDescriptionService,
    FileUtils,
    JDParserService,
    ParameterSanitizer,
    WorkspaceCacheStorageService,
  ],
  exports: [
    LinkedInSearchService,
    UnipileSearchAccountResolver,
    LinkedInSessionTrackerService,
    LinkedinParameterResolver,
    LinkedinParameterCatalogService,
  ],
})
export class LinkedInSearchModule {}

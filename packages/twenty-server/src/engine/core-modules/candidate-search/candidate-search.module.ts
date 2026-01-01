import { Module } from '@nestjs/common';
import { CandidateSearchChatController } from 'src/engine/core-modules/candidate-search/controllers/candidate-search-chat.controller';
import { SearchGenerationService } from 'src/engine/core-modules/candidate-search/services/search-generation.service';
import { ResumeReaderService } from 'src/engine/core-modules/candidate-sourcing/services/resume-reader.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { CandidateSearchHandlerService } from './services/candidate-search-handler.service';
import { CandidateSearchPromptService } from './services/candidate-search-prompt.service';
import { CandidateSearchStreamingService } from './services/candidate-search-streaming.service';
import { CandidateSearchService } from './services/candidate-search.service';
import { JobDescriptionService } from './services/job-description.service';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from './utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';
@Module({
  imports: [LinkedInSearchModule, WorkspaceModificationsModule, CandidateSourcingModule, GraphQLExecutionModule],
  controllers: [CandidateSearchController, CandidateSearchChatController],
  providers: [
    CandidateSearchService,
    CandidateSearchStreamingService,
    CandidateSearchHandlerService,
    CandidateSearchPromptService,
    JobDescriptionService,
    LinkedinParameterResolver,
    LinkedInSearchService,
    SearchGenerationService,
    ResumeReaderService,  
    ParameterSanitizer,
    FileUtils,
  ],
  exports: [CandidateSearchService, CandidateSearchStreamingService, CandidateSearchPromptService],
})
export class CandidateSearchModule {}

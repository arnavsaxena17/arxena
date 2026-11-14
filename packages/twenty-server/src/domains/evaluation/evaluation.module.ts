import { Module } from '@nestjs/common';

import { SearchParametersPrompts } from 'src/domains/planning/candidate-search/prompts/search-parameters-prompts';
import { StreamProcessingService } from 'src/engine/core-modules/llm-chat-model/services/stream-processing.service';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { ResultValidationService } from './result-validation.service';

// The judge: scores fetched rows against the brief. Shared by planning and the
// org-chart build.
// Prompts + stream helpers are stateless and registered per consuming module
// (same as CandidateSearchModule / LinkedInSearchModule); importing
// CandidateSearchModule here would cycle, since it imports this module.
@Module({
  imports: [WorkspaceModificationsModule],
  providers: [
    SearchParametersPrompts,
    StreamProcessingService,
    ResultValidationService,
  ],
  exports: [ResultValidationService],
})
export class EvaluationModule {}

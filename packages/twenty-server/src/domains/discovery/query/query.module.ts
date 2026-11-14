import { Module } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { LinkedInSearchModule } from 'src/domains/discovery/transport/linkedin-search/linkedin-search.module';

import { PythonQueryGenerationService } from './python-query-generation.service';
import { LinkedinSearchExecutionBase } from './services/linkedin-search-execution.base';
import { ParameterSanitizer } from 'src/domains/discovery/query/utils/parameter-sanitizer.util';

// The query layer: compile a brief into LinkedIn queries, and execute a query
// set against LinkedIn. Both the planner and the org-chart build need it, so it
// sits below both of them.
@Module({
  imports: [LinkedInSearchModule, UnipilePoolModule],
  providers: [
    PythonQueryGenerationService,
    LinkedinSearchExecutionBase,
    ParameterSanitizer,
  ],
  exports: [
    PythonQueryGenerationService,
    LinkedinSearchExecutionBase,
    ParameterSanitizer,
  ],
})
export class DiscoveryQueryModule {}

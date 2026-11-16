import { Injectable } from '@nestjs/common';

import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import {
  sourcingSpecFromParsedRequirement,
  type SourcingSpecDraft,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

type Agent1Options = Parameters<LinkedinQueryGenerationService['runAgent1']>[1];

// Agent 1 of the LinkedIn query chain is the one requirement parser; agents 2
// to 4 are not run here, because compiling queries belongs to the source
// adapters and the Python compiler
@Injectable()
export class SourcingSpecParserService {
  constructor(
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
  ) {}

  async parse(
    requirementText: string,
    options?: {
      targetCount?: number | null;
      budgetUsd?: number;
      llmOptions?: Agent1Options;
    },
  ): Promise<SourcingSpecDraft> {
    const parsed = await this.linkedinQueryGenerationService.runAgent1(
      requirementText,
      options?.llmOptions,
    );

    return sourcingSpecFromParsedRequirement(parsed, {
      targetCount: options?.targetCount,
      budgetUsd: options?.budgetUsd,
    });
  }
}

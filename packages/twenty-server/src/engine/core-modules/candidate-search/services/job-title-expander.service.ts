import { Injectable, Logger, Optional } from '@nestjs/common';
import OpenAI from 'openai';
import { TitleExpansionService } from 'src/engine/core-modules/title-taxonomy/title-expansion.service';
import { toOpenAiJsonSchemaResponseFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';
import {
  getJobTitleExpanderUserPrompt,
  JOB_TITLE_EXPANDER_SYSTEM_PROMPT,
} from '../prompts/job-title-expander.prompt';
import { jobTitleExpanderSchema } from '../schemas/job-title-expander.schema';
import type { JobTitleExpanderResult } from '../schemas/job-title-expander.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class JobTitleExpanderService {
  private readonly logger = new Logger(JobTitleExpanderService.name);

  constructor(
    private readonly streamProcessingService: StreamProcessingService,
    @Optional()
    private readonly titleExpansionService?: TitleExpansionService,
  ) {}

  async expandJobTitles(
    parsedRequirement: ParsedRequirement,
    openaiClient: OpenAI,
    onTokenUsage?: (usage: TokenUsage) => void,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<JobTitleExpanderResult> {
    const userPrompt = getJobTitleExpanderUserPrompt(
      JSON.stringify(parsedRequirement, null, 2),
    );
    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            { role: 'system' as const, content: JOB_TITLE_EXPANDER_SYSTEM_PROMPT },
            { role: 'user' as const, content: userPrompt },
          ],
          toOpenAiJsonSchemaResponseFormat(jobTitleExpanderSchema, 'titleAnalysis'),
        ),
      { sendEvent, maxRetries: 2 },
    );
    const content = typeof result === 'string' ? result : result.content;
    if (typeof result !== 'string' && result.usage && onTokenUsage) {
      onTokenUsage(result.usage);
    }
    if (!content) {
      this.logger.warn('Project title expander returned empty content.');
      throw new Error('Project title expander returned empty content');
    }
    const parsed = JSON.parse(content);
    const expanded = jobTitleExpanderSchema.parse(
      parsed,
    ) as JobTitleExpanderResult;

    return this.addTaxonomyTitles(parsedRequirement, expanded);
  }

  // The model lists the variations it knows; the job-title taxonomy adds the
  // curated titles filed with the same role. Broad requests that are not about
  // one role are left to the model, as before.
  private async addTaxonomyTitles(
    parsedRequirement: ParsedRequirement,
    expanded: JobTitleExpanderResult,
  ): Promise<JobTitleExpanderResult> {
    const roleName = parsedRequirement.primary_role_name?.trim() ?? '';

    if (
      roleName === '' ||
      parsedRequirement.requires_job_title_expansion !== true ||
      this.titleExpansionService === undefined
    ) {
      return expanded;
    }

    try {
      const { added } = await this.titleExpansionService.expandTitles([
        roleName,
      ]);
      const known = new Set(expanded.titles.map((title) => title.toLowerCase()));
      const newTitles = added.filter((title) => !known.has(title.toLowerCase()));

      return newTitles.length === 0
        ? expanded
        : { ...expanded, titles: [...expanded.titles, ...newTitles] };
    } catch (error) {
      this.logger.warn(
        `Job-title taxonomy expansion skipped: ${error instanceof Error ? error.message : String(error)}`,
      );

      return expanded;
    }
  }
}

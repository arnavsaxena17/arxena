import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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

  constructor(private readonly streamProcessingService: StreamProcessingService) {}

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
          zodResponseFormat(jobTitleExpanderSchema, 'titleAnalysis'),
        ),
      { sendEvent, maxRetries: 2 },
    );
    const content = typeof result === 'string' ? result : result.content;
    if (typeof result !== 'string' && result.usage && onTokenUsage) {
      onTokenUsage(result.usage);
    }
    if (!content) {
      this.logger.warn('Job title expander returned empty content.');
      throw new Error('Job title expander returned empty content');
    }
    const parsed = JSON.parse(content);
    return jobTitleExpanderSchema.parse(parsed) as JobTitleExpanderResult;
  }
}

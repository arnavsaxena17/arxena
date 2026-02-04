import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';
import type { JobTitleExpanderResult } from '../schemas/job-title-expander.schema';
import type { CompanyExpanderResult } from '../schemas/company-expander.schema';
import {
  getQueryConstructorUserPrompt,
  QUERY_CONSTRUCTOR_SYSTEM_PROMPT,
} from '../prompts/query-constructor.prompt';
import { queryConstructorSchema } from '../schemas/query-constructor.schema';
import type { QueryConstructorResult } from '../schemas/query-constructor.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class QueryConstructorService {
  private readonly logger = new Logger(QueryConstructorService.name);

  constructor(private readonly streamProcessingService: StreamProcessingService) {}

  async constructQueries(
    parsedRequirement: ParsedRequirement,
    titleAnalysis: JobTitleExpanderResult,
    companyAnalysis: CompanyExpanderResult,
    openaiClient: OpenAI,
    onTokenUsage?: (usage: TokenUsage) => void,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<QueryConstructorResult> {
    const userPrompt = getQueryConstructorUserPrompt(
      parsedRequirement,
      titleAnalysis,
      companyAnalysis,
    );
    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            { role: 'system' as const, content: QUERY_CONSTRUCTOR_SYSTEM_PROMPT },
            { role: 'user' as const, content: userPrompt },
          ],
          zodResponseFormat(queryConstructorSchema, 'queryConstructor'),
        ),
      { sendEvent, maxRetries: 2 },
    );
    const content = typeof result === 'string' ? result : result.content;
    if (typeof result !== 'string' && result.usage && onTokenUsage) {
      onTokenUsage(result.usage);
    }
    if (!content) {
      this.logger.warn('Query constructor returned empty content.');
      throw new Error('Query constructor returned empty content');
    }
    const parsed = JSON.parse(content);
    return queryConstructorSchema.parse(parsed) as QueryConstructorResult;
  }
}

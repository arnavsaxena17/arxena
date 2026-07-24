import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  getQueryConstructorUserPrompt,
  QUERY_CONSTRUCTOR_SYSTEM_PROMPT,
} from '../prompts/query-constructor.prompt';
import type { CompanyExpanderResult } from '../schemas/company-expander.schema';
import type { JobTitleExpanderResult } from '../schemas/job-title-expander.schema';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';
import type { QueryConstructorResult } from '../schemas/query-constructor.schema';
import { queryConstructorSchema } from '../schemas/query-constructor.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class QueryConstructorService {
  private readonly logger = new Logger(QueryConstructorService.name);

  constructor(private readonly streamProcessingService: StreamProcessingService) {}

  async constructQueries(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    rawQuery: string,
    cleanedQuery: string,
    parsedRequirement: ParsedRequirement,
    titleAnalysis: JobTitleExpanderResult,
    companyAnalysis: CompanyExpanderResult,
    booltreeHints: string,
    openaiClient: OpenAI,
    onTokenUsage?: (usage: TokenUsage) => void,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<QueryConstructorResult> {
    const userPrompt = getQueryConstructorUserPrompt(
      searchType,
      rawQuery,
      cleanedQuery,
      parsedRequirement,
      titleAnalysis,
      companyAnalysis,
      booltreeHints,
    );

    const messages = [
      { role: 'system' as const, content: QUERY_CONSTRUCTOR_SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ];

    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          messages,
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


    messages.forEach((m, i) => {
      this.logger.log(`Query constructor message ${i + 1} (${m.role}):\n${m.content}`);
    });
    this.logger.log(`Raw query: ${rawQuery}
    Cleaned query: ${cleanedQuery}
    Parsed requirement: ${JSON.stringify(parsedRequirement, null, 2)}
    Query constructor result:: ${JSON.stringify(parsed, null, 2)}`);
    return queryConstructorSchema.parse(parsed) as QueryConstructorResult;
  }
}

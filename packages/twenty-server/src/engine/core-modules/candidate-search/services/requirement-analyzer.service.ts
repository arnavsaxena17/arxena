import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import {
  getRequirementAnalyzerUserPrompt,
  REQUIREMENT_ANALYZER_SYSTEM_PROMPT,
} from '../prompts/requirement-analyzer.prompt';
import {
  ParsedRequirement,
  parsedRequirementSchema,
} from '../schemas/parsed-requirement.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class RequirementAnalyzerService {
  private readonly logger = new Logger(RequirementAnalyzerService.name);

  constructor(private readonly streamProcessingService: StreamProcessingService) {}

  async analyzeRequirement(
    rawQuery: string,
    cleanedQuery: string,
    openaiClient: OpenAI,
    onTokenUsage?: (usage: TokenUsage) => void,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<ParsedRequirement> {
    const userPrompt = getRequirementAnalyzerUserPrompt(rawQuery, cleanedQuery);

    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            { role: 'system' as const, content: REQUIREMENT_ANALYZER_SYSTEM_PROMPT },
            { role: 'user' as const, content: userPrompt },
          ],
          zodResponseFormat(parsedRequirementSchema, 'parsedRequirement'),
        ),
      { sendEvent, maxRetries: 2 },
    );

    const content = typeof result === 'string' ? result : result.content;

    if (typeof result !== 'string' && result.usage && onTokenUsage) {
      onTokenUsage(result.usage);
    }

    if (!content) {
      this.logger.warn('Requirement analyzer returned empty content.');
      throw new Error('Requirement analyzer returned empty content');
    }

    const parsed = JSON.parse(content);
    this.logger.log(`Requirement analyzer parsed: ${JSON.stringify(parsed, null, 2)}`);

    return parsedRequirementSchema.parse(parsed);
  }
}


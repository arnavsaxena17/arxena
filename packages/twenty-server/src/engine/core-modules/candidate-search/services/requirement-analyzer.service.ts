import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  REQUIREMENT_ANALYZER_SYSTEM_PROMPT,
  getRequirementAnalyzerUserPrompt,
} from '../prompts/requirement-analyzer.prompt';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';
import { parsedRequirementSchema } from '../schemas/parsed-requirement.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class RequirementAnalyzerService {
  private readonly logger = new Logger(RequirementAnalyzerService.name);

  constructor(private readonly streamProcessingService: StreamProcessingService) {}

  async analyzeRequirement(
    rawRequirement: string,
    openaiClient: OpenAI,
    onTokenUsage?: (usage: TokenUsage) => void,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<ParsedRequirement> {
    const userPrompt = getRequirementAnalyzerUserPrompt(rawRequirement);
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
    this.logger.log(`Requirement analyzer content:: ${content}`);
    if (!content) {
      this.logger.warn('Requirement analyzer returned empty content.');
      throw new Error('Requirement analyzer returned empty content');
    }
    const parsed = JSON.parse(content);
    return parsedRequirementSchema.parse(parsed) as ParsedRequirement;
  }
}

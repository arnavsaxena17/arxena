import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';
import {
  getCompanyExpanderUserPrompt,
  COMPANY_EXPANDER_SYSTEM_PROMPT,
} from '../prompts/company-expander.prompt';
import { companyExpanderSchema } from '../schemas/company-expander.schema';
import type { CompanyExpanderResult } from '../schemas/company-expander.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class CompanyExpanderService {
  private readonly logger = new Logger(CompanyExpanderService.name);

  constructor(private readonly streamProcessingService: StreamProcessingService) {}

  async expandCompanies(
    parsedRequirement: ParsedRequirement,
    openaiClient: OpenAI,
    onTokenUsage?: (usage: TokenUsage) => void,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<CompanyExpanderResult> {
    const userPrompt = getCompanyExpanderUserPrompt(
      JSON.stringify(parsedRequirement, null, 2),
    );
    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            { role: 'system' as const, content: COMPANY_EXPANDER_SYSTEM_PROMPT },
            { role: 'user' as const, content: userPrompt },
          ],
          zodResponseFormat(companyExpanderSchema, 'companyAnalysis'),
        ),
      { sendEvent, maxRetries: 2 },
    );
    const content = typeof result === 'string' ? result : result.content;
    if (typeof result !== 'string' && result.usage && onTokenUsage) {
      onTokenUsage(result.usage);
    }
    if (!content) {
      this.logger.warn('Company expander returned empty content.');
      throw new Error('Company expander returned empty content');
    }
    const parsed = JSON.parse(content);
    return companyExpanderSchema.parse(parsed) as CompanyExpanderResult;
  }
}

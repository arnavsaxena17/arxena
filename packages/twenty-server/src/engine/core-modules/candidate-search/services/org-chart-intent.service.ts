import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import { OrgChartParsed, OrgChartParsedSchema } from 'src/engine/core-modules/candidate-search/schemas/org-chart.schema';
import {
  ORG_CHART_INTENT_SYSTEM_PROMPT,
  OrgChartIntentUserPrompt
} from '../prompts/business-division-org-chart.prompt';
import { StreamProcessingService } from './stream-processing.service';

/**
 * Nest LLM for org-chart business-division intent: business_division_keywords,
 * optional filters, and fields consumed by title-taxonomy `resolved_intent`.
 */
@Injectable()
export class OrgChartIntentService {
  private readonly logger = new Logger(OrgChartIntentService.name);

  constructor(
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  async resolveBusinessDivision(
    openaiClient: OpenAI,
    input: {
      companyName: string;
      userRawText: string;
      defaultCountry: string;
      defaultFunctionRoot: string;
    },
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<OrgChartParsed> {
    const userPrompt = OrgChartIntentUserPrompt(input);

    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            {
              role: 'system' as const,
              content: ORG_CHART_INTENT_SYSTEM_PROMPT,
            },
            { role: 'user' as const, content: userPrompt },
          ],
          zodResponseFormat(
            OrgChartParsedSchema,
            'orgChartIntent',
          ),
        ),
      { sendEvent, maxRetries: 2 },
    );

    const content = typeof result === 'string' ? result : result.content;

    if (!content) {
      this.logger.warn('Org-chart intent LLM returned empty content.');
      throw new Error('Org-chart intent LLM returned empty content');
    }

    const parsed = JSON.parse(content);
    this.logger.log(`Org-chart intent: ${JSON.stringify(parsed, null, 2)}`);

    return OrgChartParsedSchema.parse(parsed);
  }
}

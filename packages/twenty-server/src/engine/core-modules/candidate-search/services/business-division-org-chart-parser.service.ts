import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import {
    BUSINESS_DIVISION_ORG_CHART_SYSTEM_PROMPT,
    getBusinessDivisionOrgChartUserPrompt,
} from '../prompts/business-division-org-chart.prompt';
import {
    businessDivisionOrgChartParsedSchema,
    type BusinessDivisionOrgChartParsed,
} from '../schemas/business-division-org-chart.schema';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class BusinessDivisionOrgChartParserService {
  private readonly logger = new Logger(BusinessDivisionOrgChartParserService.name);

  constructor(
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  async parseBusinessDivisionQuery(
    openaiClient: OpenAI,
    input: {
      companyName: string;
      userRawText: string;
      defaultCountry: string;
      defaultFunctionRoot: string;
    },
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<BusinessDivisionOrgChartParsed> {
    const userPrompt = getBusinessDivisionOrgChartUserPrompt(input);

    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            {
              role: 'system' as const,
              content: BUSINESS_DIVISION_ORG_CHART_SYSTEM_PROMPT,
            },
            { role: 'user' as const, content: userPrompt },
          ],
          zodResponseFormat(
            businessDivisionOrgChartParsedSchema,
            'businessDivisionOrgChart',
          ),
        ),
      { sendEvent, maxRetries: 2 },
    );

    const content = typeof result === 'string' ? result : result.content;

    if (!content) {
      this.logger.warn('Business division parser returned empty content.');
      throw new Error('Business division parser returned empty content');
    }

    const parsed = JSON.parse(content);
    this.logger.log(
      `Business division parsed: ${JSON.stringify(parsed, null, 2)}`,
    );

    return businessDivisionOrgChartParsedSchema.parse(parsed);
  }
}

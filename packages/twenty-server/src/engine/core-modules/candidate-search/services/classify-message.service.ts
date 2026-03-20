import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';

const messageClassificationSchema = z.object({
  classification: z.enum([
    'search_parameters',
    'enrichments',
    'filters',
    'sorts',
    'complete_plan',
    'general_help',
    'clarification_response',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

@Injectable()
export class ClassifyMessageService {
  private readonly logger = new Logger(ClassifyMessageService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  /**
   * Classify a chat message to determine user intent using AI.
   */
  async classifyMessage(
    message: string,
    apiToken: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>,
    rawJDText?: string,
  ): Promise<{ type: string; confidence: number; reasoning: string }> {
    try {
      this.logger.log(`Classifying message:\n${message}`);

      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken),
      );

      const prompt = this.searchParametersPrompts.getMessageClassificationPrompt(chatHistory, rawJDText);

      const systemPrompt = prompt.system;
      const userPrompt = prompt.user.replace('{{message}}', message);

      const completion = await openai.chat.completions.create({
        model: 'gpt-5.1-chat-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        // temperature: 0.1,
        response_format: zodResponseFormat(
          messageClassificationSchema,
          'messageClassification',
        ),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM for message classification');
      }

      const result = JSON.parse(content);
      const validatedResult = messageClassificationSchema.parse(result);

      this.logger.log(
        `Message classified as: ${validatedResult.classification} (confidence: ${validatedResult.confidence}) with reasoning: ${validatedResult.reasoning}`,
      );

      return {
        type: validatedResult.classification,
        confidence: validatedResult.confidence,
        reasoning: validatedResult.reasoning,
      };
    } catch (error) {
      this.logger.error(`Error classifying message: ${error.message}`);

      const fallbackClassification = this.fallbackMessageClassification(message);
      this.logger.warn(`Using fallback classification: ${fallbackClassification.type}`);

      return fallbackClassification;
    }
  }

  private fallbackMessageClassification(message: string): {
    type: string;
    confidence: number;
    reasoning: string;
  } {
    const lowerMessage = message.toLowerCase();

    const searchParamsKeywords = [
      'search parameters',
      'generate parameters',
      'linkedin parameters',
      'search criteria',
      'search filters',
      'parameters',
      'search config',
    ];

    const enrichmentsKeywords = [
      'enrichments',
      'enrichment',
      'enrich data',
      'add fields',
      'candidate data',
      'profile data',
      'additional data',
    ];

    const filtersKeywords = [
      'filters',
      'filter',
      'filtering',
      'filter data',
      'apply filters',
      'narrow down',
      'refine search',
      'filter results',
    ];

    const sortsKeywords = [
      'sort',
      'sorting',
      'order',
      'rank',
      'prioritize',
      'arrange',
      'sort by',
      'order by',
      'ranking',
      'priority',
    ];

    const completePlanKeywords = [
      'complete plan',
      'full plan',
      'entire plan',
      'all components',
      'generate everything',
      'create plan',
      'build plan',
      'setup plan',
    ];

    if (completePlanKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return {
        type: 'complete_plan',
        confidence: 0.8,
        reasoning: 'Detected complete plan keywords',
      };
    }

    if (searchParamsKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return {
        type: 'search_parameters',
        confidence: 0.7,
        reasoning: 'Detected search parameters keywords',
      };
    }

    if (enrichmentsKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return {
        type: 'enrichments',
        confidence: 0.7,
        reasoning: 'Detected enrichments keywords',
      };
    }

    if (filtersKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return {
        type: 'filters',
        confidence: 0.7,
        reasoning: 'Detected filters keywords',
      };
    }

    if (sortsKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return {
        type: 'sorts',
        confidence: 0.7,
        reasoning: 'Detected sorts keywords',
      };
    }

    return {
      type: 'general_help',
      confidence: 0.5,
      reasoning: 'No specific intent detected, defaulting to general help',
    };
  }
}


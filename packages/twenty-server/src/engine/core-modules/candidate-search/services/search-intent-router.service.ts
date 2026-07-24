import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import {
  getSearchIntentRouterUserPrompt,
  SEARCH_INTENT_ROUTER_SYSTEM_PROMPT,
} from '../prompts/search-intent-router.prompt';
import {
  SearchIntentRoute,
  searchIntentRouteSchema,
} from '../schemas/search-intent-route.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class SearchIntentRouterService {
  private readonly logger = new Logger(SearchIntentRouterService.name);

  constructor(private readonly streamProcessingService: StreamProcessingService) {}

  async routeIntent(
    rawQuery: string,
    cleanedQuery: string,
    openaiClient: OpenAI,
    onTokenUsage?: (usage: TokenUsage) => void,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<SearchIntentRoute> {
    const userPrompt = getSearchIntentRouterUserPrompt(rawQuery, cleanedQuery);

    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            {
              role: 'system' as const,
              content: SEARCH_INTENT_ROUTER_SYSTEM_PROMPT,
            },
            { role: 'user' as const, content: userPrompt },
          ],
          zodResponseFormat(searchIntentRouteSchema, 'searchIntentRoute'),
        ),
      { sendEvent, maxRetries: 2 },
    );

    const content = typeof result === 'string' ? result : result.content;

    if (typeof result !== 'string' && result.usage && onTokenUsage) {
      onTokenUsage(result.usage);
    }

    if (!content) {
      this.logger.warn('Search intent router returned empty content.');
      throw new Error('Search intent router returned empty content');
    }

    const parsed = JSON.parse(content);
    const route = searchIntentRouteSchema.parse(parsed);
    this.logger.log(
      `Search intent route: ${JSON.stringify(route, null, 2)}`,
    );

    return route;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';

import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { QueryCleanupPrompts } from '../prompts/query-cleanup-prompts';
import { queryCleanupSchema } from '../schemas/query-cleanup.schema';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  /**
   * Clean up a client search query to make it more realistic.
   * Removes overly demanding requirements that candidates don't explicitly mention
   * in resumes/LinkedIn profiles.
   */
  async cleanupQuery(
    rawQuery: string,
    apiToken: string,
  ): Promise<string> {
    try {
      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken),
      );

      const systemPrompt = QueryCleanupPrompts.getSystemPrompt();
      const userPrompt = QueryCleanupPrompts.getUserPrompt(rawQuery);

      const completion = await openai.chat.completions.create({
        model: 'gpt-5.1-chat-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(queryCleanupSchema, 'queryCleanup'),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        this.logger.warn('Query cleanup returned empty content, using original query');
        return rawQuery;
      }

      const parsed = JSON.parse(content);
      const validated = queryCleanupSchema.parse(parsed);

      this.logger.log(`Raw query: "${rawQuery}" -> Cleaned query: "${validated.cleanedQuery}"`);
      return validated.cleanedQuery;
    } catch (error) {
      this.logger.error(`Error cleaning up query: ${error}`);
      // Return original query on error
      return rawQuery;
    }
  }
}


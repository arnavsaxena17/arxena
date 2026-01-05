import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { classicCompaniesSearchSchema } from '../schemas/classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/classic-jobs-search.schema';
import {
    classicPeopleSearchSchema,
} from '../schemas/classic-people-search.schema';
import {
    createQuerySimplificationSchema,
    QuerySimplification
} from '../schemas/query-simplification.schema';
import {
    recruiterPeopleSearchSchema,
} from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import {
    salesNavigatorPeopleSearchSchema,
} from '../schemas/sales-navigator-people-search.schema';
import {
    GeneratedSearchParameters,
    ParsedJobDescription,
    QueryUnderstanding,
} from '../types/candidate-search-request.type';

@Injectable()
export class QuerySimplificationService {
  private readonly logger = new Logger(QuerySimplificationService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  /**
   * Simplify a failed query using LLM
   * @param failedParameters The parameters that caused "Content too large" error
   * @param searchType The search type (classic, sales_navigator, recruiter)
   * @param searchCategory The search category (people, companies, jobs)
   * @param apiToken API token for workspace
   * @param attemptNumber Current simplification attempt (1-3)
   * @param previousAttempts Array of previous simplification attempts (to avoid repeating)
   * @param queryUnderstanding Optional query understanding context
   * @param userMessage Optional user message for context
   * @param parsedJobDescription Optional parsed JD for context
   * @param sendEvent Optional event callback for progress updates
   * @returns Simplified parameters or null if simplification failed
   */
  async simplifyQuery(
    failedParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    attemptNumber: number = 1,
    previousAttempts: QuerySimplification[] = [],
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
    parsedJobDescription?: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<QuerySimplification | null> {
    try {
      this.logger.log(
        `Simplifying query (attempt ${attemptNumber}/3) for ${searchType} ${searchCategory}`,
      );

      const eventResult = sendEvent?.('querySimplification', {
        attempt: attemptNumber,
        status: 'simplifying',
        message: `Simplifying query (attempt ${attemptNumber}/3)...`,
      });
      if (eventResult === false) {
        this.logger.log('Stream aborted during query simplification');
        return null;
      }

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      // Build the simplification prompt
      const simplificationPrompt = this.searchParametersPrompts.buildQuerySimplificationPrompt(
        failedParameters,
        searchType,
        searchCategory,
        attemptNumber,
        previousAttempts,
        queryUnderstanding,
        userMessage,
        parsedJobDescription,
      );

      // Determine which schema to use based on search type and category
      let schema: any;
      let schemaName: string;
      let parameterKey: string;

      if (searchCategory === 'people') {
        switch (searchType) {
          case 'classic':
            schema = classicPeopleSearchSchema;
            schemaName = 'classicPeopleSearch';
            parameterKey = 'classicPeopleSearch';
            break;
          case 'sales_navigator':
            schema = salesNavigatorPeopleSearchSchema;
            schemaName = 'salesNavigatorPeopleSearch';
            parameterKey = 'salesNavigatorPeopleSearch';
            break;
          case 'recruiter':
            schema = recruiterPeopleSearchSchema;
            schemaName = 'recruiterPeopleSearch';
            parameterKey = 'recruiterPeopleSearch';
            break;
        }
      } else if (searchCategory === 'companies') {
        if (searchType === 'classic') {
          schema = classicCompaniesSearchSchema;
          schemaName = 'classicCompaniesSearch';
          parameterKey = 'classicCompaniesSearch';
        } else {
          schema = salesNavigatorCompaniesSearchSchema;
          schemaName = 'salesNavigatorCompaniesSearch';
          parameterKey = 'salesNavigatorCompaniesSearch';
        }
      } else if (searchCategory === 'jobs' && searchType === 'classic') {
        schema = classicJobsSearchSchema;
        schemaName = 'classicJobsSearch';
        parameterKey = 'classicJobsSearch';
      } else {
        this.logger.warn(
          `Unsupported search type/category combination: ${searchType} ${searchCategory}`,
        );
        return null;
      }

      // Create a type-safe wrapper schema with the correct simplifiedParameters type
      const wrapperSchema = createQuerySimplificationSchema(schema);

      // Call LLM to simplify the query
      const stream = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at simplifying LinkedIn search queries that are too complex. Analyze the failed query and generate a simplified version that reduces complexity while preserving search intent. Focus on reducing keyword count, removing redundant filters, and simplifying boolean logic.',
          },
          { role: 'user', content: simplificationPrompt },
        ],
        stream: true,
        response_format: zodResponseFormat(wrapperSchema, 'querySimplification'),
      });

      // Process stream chunks
      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          const eventSent = sendEvent?.('querySimplification', {
            attempt: attemptNumber,
            status: 'streaming',
            content: delta,
          });
          if (eventSent === false) {
            this.logger.log('Stream aborted during simplification');
            return null;
          }
        }
      }

      if (!fullContent || fullContent.trim().length === 0) {
        this.logger.warn('Query simplification returned empty content');
        return null;
      }

      // Parse and validate the response
      let parsed: any;
      try {
        parsed = JSON.parse(fullContent);
      } catch (parseError) {
        this.logger.error(`Failed to parse simplification response: ${parseError}`);
        return null;
      }

      const validated = wrapperSchema.parse(parsed);

      // Wrap the simplified parameters in the same structure as the original
      const simplifiedParams: GeneratedSearchParameters = {
        [parameterKey]: validated.simplifiedParameters,
      };

      const result: QuerySimplification = {
        simplifiedParameters: simplifiedParams,
        strategy: validated.strategy,
        modifications: validated.modifications,
        reasoning: validated.reasoning,
        estimatedComplexity: validated.estimatedComplexity,
        keywordsTermCount: validated.keywordsTermCount,
      };

      this.logger.log(
        `Query simplification completed (attempt ${attemptNumber}): ${JSON.stringify(result, null, 2)}`,
      );

      sendEvent?.('querySimplification', {
        attempt: attemptNumber,
        status: 'completed',
        strategy: result.strategy,
        modifications: result.modifications,
        message: `Simplified query using strategy: ${result.strategy}`,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to simplify query (attempt ${attemptNumber}): ${error}`);
      sendEvent?.('querySimplification', {
        attempt: attemptNumber,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        message: `Query simplification failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      return null;
    }
  }

  /**
   * Check if an error is a "Content too large" error that requires simplification
   */
  isContentTooLargeError(error: any): boolean {
    if (!error) return false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes('Content too large') ||
      errorMessage.includes('content_too_large') ||
      errorMessage.includes('request payload is so large')
    );
  }

  /**
   * Check if an error is a service unavailable error (503/504)
   */
  isServiceUnavailableError(error: any): boolean {
    if (!error) return false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('Service unavailable') ||
      errorMessage.includes('service_unavailable')
    );
  }
}


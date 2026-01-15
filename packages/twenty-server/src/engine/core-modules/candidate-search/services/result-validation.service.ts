import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { LinkedInSearchResult } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { resultValidationSchema } from '../schemas/result-validation.schema';
import { QueryUnderstanding, ResultValidationResult } from '../types/candidate-search-request.type';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class ResultValidationService {
  private readonly logger = new Logger(ResultValidationService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  async validateResultsAgainstQuery(
    searchResults: LinkedInSearchResult[],
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<ResultValidationResult> {
    if (searchResults.length === 0) {
      return {
        isRelevant: false,
        relevanceScore: 0,
        falsePositives: [],
        qualityAssessment: 'low',
        shouldContinuePagination: false,
        reasoning: 'No results to validate',
      };
    }

    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );

      const validationSystemPrompt = this.searchParametersPrompts.getResultValidationSystemPrompt();
      const validationPrompt = this.searchParametersPrompts.buildResultValidationPrompt(
        searchResults,
        queryUnderstanding,
        userMessage,
      );

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: validationSystemPrompt
          },
          { role: 'user' as const, content: validationPrompt },
        ],
        zodResponseFormat(resultValidationSchema, 'resultValidation'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      this.logger.log(`fullContent for result validation: ${JSON.stringify(fullContent, null, 2)}`);
      if (!fullContent) {
        this.logger.warn('Result validation returned empty content.');
        return {
          isRelevant: true, // Default to true
          relevanceScore: 0.7,
          falsePositives: [],
          qualityAssessment: 'medium',
          shouldContinuePagination: true,
          reasoning: 'Validation failed, defaulting to continue',
        } as ResultValidationResult;
      }

      // Extract content string from StreamProcessingResult
      const contentString = typeof fullContent === 'string' ? fullContent : fullContent?.content || '';
      if (!contentString) {
        this.logger.warn('Result validation returned empty content string.');
        return {
          isRelevant: true, // Default to true
          relevanceScore: 0.7,
          falsePositives: [],
          qualityAssessment: 'medium',
          shouldContinuePagination: true,
          reasoning: 'Validation failed, defaulting to continue',
        } as ResultValidationResult;
      }

      // Parse JSON string to object before Zod validation
      let parsed: any;
      try {
        parsed = JSON.parse(contentString);
      } catch (parseError) {
        this.logger.error(`Failed to parse validation result JSON: ${parseError}. Content: ${contentString.substring(0, 200)}`);
        return {
          isRelevant: true, // Default to true
          relevanceScore: 0.7,
          falsePositives: [],
          qualityAssessment: 'medium',
          shouldContinuePagination: true,
          reasoning: 'JSON parse error, defaulting to continue',
        } as ResultValidationResult;
      }

      const validated = resultValidationSchema.parse(parsed);
      this.logger.log(
        `Result validation completed - ` +
        `Relevance score: ${(validated.relevanceScore * 100).toFixed(2)}%, ` +
        `Quality: ${validated.qualityAssessment}, ` +
        `Is relevant: ${validated.isRelevant}, ` +
        `Should continue: ${validated.shouldContinuePagination}, ` +
        `False positives: ${validated.falsePositives?.length || 0}, ` +
        `Results validated: ${searchResults.length}`
      );
      return validated;
    } catch (error) {
      this.logger.error(`Failed to validate results: ${error}`);
      return {
        isRelevant: true, // Default to true on error
        relevanceScore: 0.7,
        falsePositives: [],
        qualityAssessment: 'medium',
        shouldContinuePagination: true,
        reasoning: 'Validation error, defaulting to continue',
      } as ResultValidationResult;
    }
  }

  /**
   * Decide whether to continue pagination based on validation
   * Pagination continues until either:
   * 1. Max pages reached (no more pages available)
   * 2. Relevance score falls below 0.4 (quality threshold)
   */
  shouldContinuePagination(
    validationResult: ResultValidationResult,
    currentCount: number,
    targetMin: number = 40,
    targetMax: number = 80,
    maxPages: number = 5,
    currentPage: number = 1,
  ): boolean {
    // Don't continue if we've reached max pages
    if (currentPage >= maxPages) {
      this.logger.log(
        `Stopping pagination: Reached max pages (${currentPage}/${maxPages})`
      );
      return false;
    }

    // Don't continue if relevance score falls below 0.4 (quality threshold)
    const qualityThreshold = 0.4;
    if (validationResult.relevanceScore < qualityThreshold) {
      this.logger.log(
        `Stopping pagination: Relevance score ${validationResult.relevanceScore.toFixed(2)} below quality threshold ${qualityThreshold}`
      );
      return false;
    }

    // Continue pagination if we haven't hit the stopping conditions
    this.logger.log(
      `Continuing pagination: Page ${currentPage}/${maxPages}, Relevance score: ${validationResult.relevanceScore.toFixed(2)}, Total candidates: ${currentCount}`
    );
    return true;
  }


}


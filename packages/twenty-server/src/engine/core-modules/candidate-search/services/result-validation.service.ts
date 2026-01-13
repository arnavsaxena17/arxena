import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
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
    searchResults: any[],
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
            content: 'You are an expert at validating LinkedIn search results. Assess relevance, quality, and determine if pagination should continue.' 
          },
          { role: 'user' as const, content: validationPrompt },
        ],
        zodResponseFormat(resultValidationSchema, 'resultValidation'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

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

      const parsed = JSON.parse(fullContent);
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
      return false;
    }

    // Don't continue if results are not relevant
    if (!validationResult.isRelevant) {
      return false;
    }

    // Don't continue if quality is low
    if (validationResult.qualityAssessment === 'low') {
      return false;
    }

    // Don't continue if relevance score is too low
    const minRelevanceScore = Number(process.env.MIN_RELEVANCE_SCORE ?? 0.6);
    if (validationResult.relevanceScore < minRelevanceScore) {
      return false;
    }

    // Don't continue if we've reached target max
    if (currentCount >= targetMax) {
      return false;
    }

    // Continue if we haven't reached target min and quality is acceptable
    if (currentCount < targetMin && (validationResult.qualityAssessment === 'high' || validationResult.qualityAssessment === 'medium')) {
      return true;
    }

    // Use the validation result's recommendation
    return validationResult.shouldContinuePagination;
  }


}


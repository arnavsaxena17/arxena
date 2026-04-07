import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { LinkedInSearchResult } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { resultValidationSchema } from '../schemas/result-validation.schema';
import { ResultValidationResult } from '../types/candidate-search-request.type';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class ResultValidationService {
  private readonly logger = new Logger(ResultValidationService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * LLM pagination gate for LinkedIn x-ray SERP after Bright Data profile enrichment.
   */
  async validateLinkedinXraySerpPageForPagination(
    searchResults: LinkedInSearchResult[],
    requirementText: string,
    requiredCompanyName: string,
    totalProfilesCollectedSoFar: number,
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
        reasoning: 'No enriched results to validate',
      };
    }

    console.log("Search results : ", searchResults)
    console.log("Requirement text : ", requirementText)
    console.log("Required company name : ", requiredCompanyName)
    console.log("Total profiles collected so far : ", totalProfilesCollectedSoFar)
    console.log("Api token : ", apiToken)

    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken),
      );

      const validationSystemPrompt =
        this.searchParametersPrompts.getLinkedinXraySerpPaginationValidationSystemPrompt();
      const validationUserPrompt =
        this.searchParametersPrompts.buildLinkedinXraySerpPaginationValidationPrompt(
          searchResults,
          requirementText,
          requiredCompanyName,
          totalProfilesCollectedSoFar,
        );

      const validationPrompt = [
        { role: 'system' as const, content: validationSystemPrompt },
        { role: 'user' as const, content: validationUserPrompt },
      ];

      this.logger.log(
        `LinkedIn x-ray SERP pagination validation prompt: ${JSON.stringify(validationPrompt, null, 2)}`,
      );

      const fullContent = await this.streamProcessingService.executeStreamingLlmCall(
        () =>
          this.streamProcessingService.createStreamingCompletion(
            openaiClient,
            validationPrompt,
            zodResponseFormat(resultValidationSchema, 'resultValidation'),
          ),
        { sendEvent, maxRetries: 2 },
      );

      console.log("Full content : ", fullContent)
      if (!fullContent) {
        return {
          isRelevant: true,
          relevanceScore: 0.7,
          falsePositives: [],
          qualityAssessment: 'medium',
          shouldContinuePagination: true,
          reasoning: 'Validation empty, defaulting to continue',
        } as ResultValidationResult;
      }

      const contentString =
        typeof fullContent === 'string' ? fullContent : fullContent?.content || '';

      if (!contentString) {
        return {
          isRelevant: true,
          relevanceScore: 0.7,
          falsePositives: [],
          qualityAssessment: 'medium',
          shouldContinuePagination: true,
          reasoning: 'Validation empty string, defaulting to continue',
        } as ResultValidationResult;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(contentString);
      } catch (parseError) {
        this.logger.error(
          `Failed to parse LinkedIn x-ray validation JSON: ${parseError}. Content: ${contentString.substring(0, 200)}`,
        );

        return {
          isRelevant: true,
          relevanceScore: 0.7,
          falsePositives: [],
          qualityAssessment: 'medium',
          shouldContinuePagination: true,
          reasoning: 'JSON parse error, defaulting to continue',
        } as ResultValidationResult;
      }

      const validated = resultValidationSchema.parse(parsed);

      this.logger.log(
        `LinkedIn x-ray SERP pagination validation: relevance=${validated.relevanceScore} continue=${validated.shouldContinuePagination} ` +
          `company="${requiredCompanyName}" pageSize=${searchResults.length} totalSoFar=${totalProfilesCollectedSoFar}`,
      );

      return validated;
    } catch (error) {
      this.logger.error(`LinkedIn x-ray SERP pagination validation failed: ${error}`);

      return {
        isRelevant: true,
        relevanceScore: 0.7,
        falsePositives: [],
        qualityAssessment: 'medium',
        shouldContinuePagination: true,
        reasoning: 'Validation error, defaulting to continue',
      } as ResultValidationResult;
    }
  }

  async validateResultsAgainstQuery(
    searchResults: LinkedInSearchResult[],
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
      const validationUserPrompt = this.searchParametersPrompts.buildResultValidationPrompt(
        searchResults,
        userMessage,
      );

      const validationPrompt = [
        { 
          role: 'system' as const, 
          content: validationSystemPrompt
        },
        { role: 'user' as const, content: validationUserPrompt },
      ];

      this.logger.log(`validationPrompt for result validation: ${JSON.stringify(validationPrompt, null, 2)}`);
      const fullContent = await this.streamProcessingService.executeStreamingLlmCall(
        () =>
          this.streamProcessingService.createStreamingCompletion(
            openaiClient,
            validationPrompt,
            zodResponseFormat(resultValidationSchema, 'resultValidation'),
          ),
        { sendEvent, maxRetries: 2 },
      );
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
   * Pagination continues until:
   * 1. Relevance score falls below 0.4 (quality threshold)
   * 2. Validation result indicates should not continue
   */
  shouldContinuePagination(
    validationResult: ResultValidationResult,
    currentCount: number,
    currentPage: number = 1,
  ): boolean {
    // Don't continue if validation result explicitly says not to
    if (validationResult.shouldContinuePagination === false) {
      this.logger.log(
        `Stopping pagination: Validation result indicates should not continue (page ${currentPage})`
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
      `Continuing pagination: Page ${currentPage}, Relevance score: ${validationResult.relevanceScore.toFixed(2)}, Total candidates: ${currentCount}`
    );
    return true;
  }


}


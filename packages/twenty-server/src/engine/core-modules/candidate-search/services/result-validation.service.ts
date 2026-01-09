import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
    LinkedInClassicPeopleSearchRequest,
    LinkedInRecruiterPeopleSearchRequest,
    LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { classicPeopleSearchSchema, ClassicPeopleStrategyDefinition } from '../schemas/classic-people-search.schema';
import { recruiterPeopleSearchSchema, RecruiterPeopleStrategyDefinition } from '../schemas/recruiter-people-search.schema';
import { resultValidationSchema } from '../schemas/result-validation.schema';
import { salesNavigatorPeopleSearchSchema, SalesNavigatorPeopleStrategyDefinition } from '../schemas/sales-navigator-people-search.schema';
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
      this.logger.log(`Result validation: ${JSON.stringify(validated, null, 2)}`);
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

  /**
   * Validate parameter coherence
   */
  async validateParameterCoherence(
    openaiClient: OpenAI,
    generatedParameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    queryUnderstanding: QueryUnderstanding,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<{
    isCoherent: boolean;
    issues: string[];
    suggestedRefinements: string[];
    estimatedResultCount: 'low' | 'medium' | 'high';
    reasoning?: string | null;
  }> {
    sendEvent?.('status', { message: 'Validating parameter coherence...' });
    
    const validationPrompt = this.searchParametersPrompts.buildParameterValidationPrompt(
      generatedParameters,
      queryUnderstanding,
      {
        label: strategy.label,
        goal: strategy.goal,
        aggressiveness: strategy.aggressiveness,
        estimatedCandidateCount: strategy.estimatedCandidateCount,
      },
      searchType,
    );

    const validationSchema = z.object({
      isCoherent: z.boolean(),
      issues: z.array(z.string()),
      suggestedRefinements: z.array(z.string()),
      estimatedResultCount: z.enum(['low', 'medium', 'high']),
      reasoning: z.string().nullable().optional(),
    });

    try {
      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert at validating LinkedIn search parameters. Analyze parameters for coherence, effectiveness, and potential issues.' 
          },
          { role: 'user' as const, content: validationPrompt },
        ],
        zodResponseFormat(validationSchema, 'parameterValidation'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Parameter validation returned empty content.');
        return {
          isCoherent: true, // Default to true if validation fails
          issues: [],
          suggestedRefinements: [],
          estimatedResultCount: 'medium',
        };
      }

      const parsed = JSON.parse(fullContent);
      const validated = validationSchema.parse(parsed);
      this.logger.log(`Parameter validation: ${JSON.stringify(validated, null, 2)}`);
      return validated;
    } catch (error) {
      this.logger.error(`Failed to validate parameters: ${error}`);
      return {
        isCoherent: true, // Default to true on error
        issues: [],
        suggestedRefinements: [],
        estimatedResultCount: 'medium',
      };
    }
  }

  /**
   * Optimize parameters based on validation results
   */
  async optimizeParameters(
    openaiClient: OpenAI,
    generatedParameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    queryUnderstanding: QueryUnderstanding,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    validationResult: {
      issues: string[];
      suggestedRefinements: string[];
      estimatedResultCount: 'low' | 'medium' | 'high';
    },
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    if (validationResult.issues.length === 0 && validationResult.estimatedResultCount !== 'low') {
      // No optimization needed
      return generatedParameters;
    }

    sendEvent?.('status', { message: 'Optimizing parameters...' });
    
    const targetCount = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const optimizationPrompt = `Optimize these LinkedIn search parameters to better match the target candidate count of ${targetCount.minimum}-${targetCount.maximum}:

    CURRENT PARAMETERS:
    ${JSON.stringify(generatedParameters, null, 2)}

    QUERY UNDERSTANDING:
    Primary Role: ${queryUnderstanding.primaryRole}
    Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
    Location: ${queryUnderstanding.locationHierarchy.primary}
    Domain: ${queryUnderstanding.domainContext || 'Not specified'}

    VALIDATION ISSUES:
    ${validationResult.issues.join('\n')}

    SUGGESTED REFINEMENTS:
    ${validationResult.suggestedRefinements.join('\n')}

    ESTIMATED RESULT COUNT: ${validationResult.estimatedResultCount}

    STRATEGY: ${strategy.label} (${strategy.aggressiveness})

    OPTIMIZATION GOALS:
    1. Adjust filters to target ${targetCount.minimum}-${targetCount.maximum} candidates
    2. Address validation issues
    3. Implement suggested refinements
    4. Maintain coherence with query understanding
    5. Preserve strategy aggressiveness level

    Return optimized parameters in the same format as the current parameters.`;

    let schema: any;
    let schemaName: string;
    
    switch (searchType) {
      case 'classic':
        schema = classicPeopleSearchSchema;
        schemaName = 'classicPeopleSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorPeopleSearchSchema;
        schemaName = 'salesNavigatorPeopleSearch';
        break;
      case 'recruiter':
        schema = recruiterPeopleSearchSchema;
        schemaName = 'recruiterPeopleSearch';
        break;
    }

    try {
      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType)
          },
          { role: 'user' as const, content: optimizationPrompt },
        ],
        zodResponseFormat(schema, schemaName),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Parameter optimization returned empty content, using original parameters.');
        return generatedParameters;
      }

      const parsed = JSON.parse(fullContent);
      this.logger.log(`Optimized parameters: ${JSON.stringify(parsed, null, 2)}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Failed to optimize parameters: ${error}`);
      return generatedParameters; // Return original on error
    }
  }
}


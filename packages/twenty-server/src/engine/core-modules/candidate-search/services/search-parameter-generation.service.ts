import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { classicCompaniesSearchSchema } from '../schemas/classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/classic-jobs-search.schema';
import {
  ClassicPeopleParameterDecision,
  ClassicPeopleParameterName,
  ClassicPeopleParameterSelection,
  ClassicPeopleStrategyDefinition,
  ClassicPeopleStrategyPlan,
  classicPeopleSearchSchema,
  classicPeopleStrategyPlanSchema,
} from '../schemas/classic-people-search.schema';
import { enhancedKeywordSchema } from '../schemas/enhanced-keywords.schema';
import { hierarchicalSearchStrategySchema } from '../schemas/hierarchical-search-strategy.schema';
import {
  RecruiterPeopleParameterDecision,
  RecruiterPeopleParameterName,
  RecruiterPeopleParameterSelection,
  RecruiterPeopleStrategyDefinition,
  RecruiterPeopleStrategyPlan,
  recruiterPeopleSearchSchema,
  recruiterPeopleStrategyPlanSchema,
} from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import {
  SalesNavigatorPeopleParameterDecision,
  SalesNavigatorPeopleParameterName,
  SalesNavigatorPeopleParameterSelection,
  SalesNavigatorPeopleStrategyDefinition,
  SalesNavigatorPeopleStrategyPlan,
  salesNavigatorPeopleSearchSchema,
  salesNavigatorPeopleStrategyPlanSchema,
} from '../schemas/sales-navigator-people-search.schema';
import {
  ClassicPeopleSearchStrategyResult,
  ParsedJobDescription,
  QueryUnderstanding,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import {
  assignClassicPeopleParameterValue,
  assignRecruiterPeopleParameterValue,
  assignSalesNavigatorPeopleParameterValue,
  buildDefaultParameterSelection,
  buildDefaultRecruiterPeopleParameterSelection,
  buildDefaultSalesNavigatorPeopleParameterSelection,
  classicPeopleParameterSchemaMap,
  createClassicPeopleBaseResult,
  createRecruiterPeopleBaseResult,
  createSalesNavigatorPeopleBaseResult,
  recruiterPeopleParameterSchemaMap,
  salesNavigatorPeopleParameterSchemaMap,
} from './candidate-search-utils';
import { QueryUnderstandingService } from './query-understanding.service';
import { ResultValidationService } from './result-validation.service';
import { SearchStrategyService } from './search-strategy.service';
import { StreamProcessingService } from './stream-processing.service';

type ClassicPeopleSearchGenerationResult = {
  primary: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
  strategies?: ClassicPeopleSearchStrategyResult[];
};

type SalesNavigatorPeopleSearchGenerationResult = {
  primary: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
  strategies?: SalesNavigatorPeopleSearchStrategyResult[];
};

type RecruiterPeopleSearchGenerationResult = {
  primary: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
  strategies?: RecruiterPeopleSearchStrategyResult[];
};

@Injectable()
export class SearchParameterGenerationService {
  private readonly logger = new Logger(SearchParameterGenerationService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly searchStrategyService: SearchStrategyService,
    private readonly resultValidationService: ResultValidationService,
  ) {}

  /**
   * Main entry point for generating people search parameters with strategies
   * Handles both multi-strategy (with user message) and standard (without user message) approaches
   * Uses adaptive strategy generation based on query complexity
   */
  async streamPeopleSearchStrategiesParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    userMessage?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding, // Accept queryUnderstanding to avoid re-computation
    apiToken?: string,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  > {

    
    if (queryUnderstanding && userMessage) {
      // Step 2: Check if hierarchical search is needed
      if (queryUnderstanding.hierarchicalSearchRequired || 
          (queryUnderstanding.seniorityLevel === 'c_level' || queryUnderstanding.seniorityLevel === 'executive') &&
          queryUnderstanding.industry && queryUnderstanding.industry.length > 0) {
        // Generate hierarchical search strategies
        return await this.generateHierarchicalSearchStrategies(
          openaiClient,
          parsedJobDescription,
          queryUnderstanding,
          userMessage,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
          apiToken,
        );
      }

      // Step 3: Format query understanding as text for passing between LLM calls
      const queryUnderstandingText = this.searchStrategyService.formatQueryUnderstandingAsText(
        queryUnderstanding,
        userMessage,
      );

      // // Step 4: Assess query complexity (now returns complexity + reasoning)
      // const complexityResult = await this.searchStrategyService.assessQueryComplexity(
      //   openaiClient,
      //   queryUnderstanding,
      //   userMessage,
      //   sendEvent,
      // );
      // this.logger.log(`Query complexity assessed as: ${complexityResult.complexity} - ${complexityResult.reasoning}`);

      // // Step 5: Generate search strategies as text
      const strategies = await this.searchStrategyService.generateSearchStrategiesAsText(
        openaiClient,
        queryUnderstandingText,
        userMessage,
        searchType,
        sendEvent,
      );

      if (!strategies || strategies.length === 0) {
        this.logger.warn('No strategies generated, falling back to single search');
        const fallbackParams = await this.generateFallbackParameters(
          openaiClient,
          parsedJobDescription,
          userMessage,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
          queryUnderstanding,
        );
        return this.wrapParametersAsResult(fallbackParams, searchType);
      }

      this.logger.log(`Generated ${strategies.length} search strategies as text`);

      // Step 6: Generate parameters for each strategy
      const strategyResults: Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult> = [];
      let primaryParams: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> | 
                         Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> | 
                         Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> | null = null;

      for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        const eventResult = sendEvent?.('status', { 
          message: `Generating parameters for strategy ${i + 1}/${strategies.length}: ${strategy.label || 'Strategy ' + (i + 1)}...` 
        });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping strategy parameter generation');
          break;
        }

        const parameterResult = await this.streamPeopleParametersFromStrategyText(
          openaiClient,
          strategy.strategyText,
          queryUnderstandingText,
          userMessage,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
        );

        if (!parameterResult || !parameterResult.parameters) {
          this.logger.warn(`Strategy ${i + 1} did not produce usable parameters`);
          continue;
        }

        // Set first strategy as primary
        if (i === 0) {
          primaryParams = parameterResult.parameters;
        }

        // Create strategy result from parameters and strategy text
        const strategyResult = this.searchStrategyService.createStrategyResultFromParameters(
          parameterResult.parameters,
          searchType,
          {
            id: `strategy-${i + 1}`,
            label: strategy.label || `Strategy ${i + 1}`,
            goal: `Search strategy: ${strategy.strategyText}`,
            aggressiveness: i === 0 ? 'focused' as const : 'balanced' as const,
            description: strategy.strategyText,
            whenToUse: i === 0 
              ? 'Primary search strategy based on query requirements'
              : `Alternative strategy ${i} - use if primary search yields insufficient results`,
            estimatedCandidateCount: strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 },
            filterFocus: strategy.strategyText,
          },
        );

        // Add parameter rationales from parameter generation result
        if (searchType === 'classic') {
          (strategyResult as ClassicPeopleSearchStrategyResult).parameterRationales = parameterResult.parameterRationales as Record<ClassicPeopleParameterName, string>;
        } else if (searchType === 'sales_navigator') {
          (strategyResult as SalesNavigatorPeopleSearchStrategyResult).parameterRationales = parameterResult.parameterRationales;
        } else {
          (strategyResult as RecruiterPeopleSearchStrategyResult).parameterRationales = parameterResult.parameterRationales;
        }

        strategyResults.push(strategyResult);
      }

      // Return results
      if (strategyResults.length === 0) {
        this.logger.warn('No strategies produced usable parameters, falling back to single search');
        const fallbackParams = await this.generateFallbackParameters(
          openaiClient,
          parsedJobDescription,
          userMessage,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
          queryUnderstanding,
        );
        return this.wrapParametersAsResult(fallbackParams, searchType);
      }

      // Use first strategy as primary, rest as alternatives
      const primary = primaryParams || strategyResults[0].parameters;
      const otherStrategies = strategyResults.slice(1);

      if (searchType === 'classic') {
        return {
          primary: primary as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies.length > 0 ? (otherStrategies as ClassicPeopleSearchStrategyResult[]) : undefined,
        };
      } else if (searchType === 'sales_navigator') {
        return {
          primary: primary as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies.length > 0 ? (otherStrategies as SalesNavigatorPeopleSearchStrategyResult[]) : undefined,
        };
      } else {
        return {
          primary: primary as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies.length > 0 ? (otherStrategies as RecruiterPeopleSearchStrategyResult[]) : undefined,
        };
      }
    }

    // No user message - use standard prompt generation
    const standardParameters = await this.generateStandardParameters(
      openaiClient,
      parsedJobDescription,
      rawJDText,
      searchType,
      sendEvent,
      includeJd,
    );

    return this.wrapParametersAsResult(standardParameters, searchType);
  }

  /**
   * Generate a focused search using text-based strategy generation
   * @deprecated This method is kept for backward compatibility but now uses text-based strategies
   */
  async generateFocusedSearchWithIndependentParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    // Format query understanding as text
    const queryUnderstandingText = this.searchStrategyService.formatQueryUnderstandingAsText(
      queryUnderstanding,
      userMessage,
    );

    // // Assess complexity to get reasoning
    // const complexityResult = await this.searchStrategyService.assessQueryComplexity(
    //   openaiClient,
    //   queryUnderstanding,
    //   userMessage,
    //   sendEvent,
    // );

    // Generate a single focused strategy
    const strategies = await this.searchStrategyService.generateSearchStrategiesAsText(
      openaiClient,
      queryUnderstandingText,
      userMessage,
      searchType,
      sendEvent,
    );

    if (!strategies || strategies.length === 0) {
      this.logger.warn('Strategy generation failed, falling back to single-prompt approach');
      return await this.generateSingleOptimizedSearch(
        openaiClient,
        parsedJobDescription,
        queryUnderstanding,
        userMessage,
        rawJDText,
        searchType,
        sendEvent,
        includeJd,
      );
    }

    // Use the first strategy (should be focused for simple queries)
    const strategyText = strategies[0].strategyText;
    
    const result = await this.streamPeopleParametersFromStrategyText(
      openaiClient,
      strategyText,
      queryUnderstandingText,
      userMessage,
      rawJDText,
      searchType,
      sendEvent,
      includeJd,
    );

    if (!result || !result.parameters) {
      this.logger.warn('Parameter generation from strategy text failed, falling back to single-prompt approach');
      return await this.generateSingleOptimizedSearch(
        openaiClient,
        parsedJobDescription,
        queryUnderstanding,
        userMessage,
        rawJDText,
        searchType,
        sendEvent,
        includeJd,
      );
    }

    // Post-process to remove redundant filters
    this.removeRedundantFilters(result.parameters, searchType);

    return result.parameters;
  }

  /**
   * Generate a single optimized search without strategy overhead (fallback method)
   */
  async generateSingleOptimizedSearch(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const userPrioritizedPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
      userMessage,
      includeJd ? rawJDText : '',
      'people',
      searchType
    );
    
    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      parameterGenerationSystemPrompt,
      userPrioritizedPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Generate an alternative search with slightly different approach
   */
  async generateAlternativeSearch(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const alternativePrompt = `${this.searchParametersPrompts.buildUserPrioritizedPrompt(
      userMessage,
      includeJd ? rawJDText : '',
      'people',
      searchType
    )}

ALTERNATIVE APPROACH:
Generate an alternative parameter set with a different filter balance. If the primary search is focused, make this one broader. If the primary is broad, make this one more focused. Adjust filters to provide a complementary search strategy.`;

    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      parameterGenerationSystemPrompt,
      alternativePrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Attempts to generate parameters using multi-strategy approach
   */
  async tryMultiStrategyApproach(
    openaiClient: OpenAI,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
    | null
  > {
    const strategyPlanningSystemPrompt = this.searchParametersPrompts.getPeopleSearchStrategySystemPrompt(searchType);
    const strategyPlanningUserPrompt = this.searchParametersPrompts.decidingWhichParametersToCreateForPeopleSearch(
      userMessage,
      includeJd ? rawJDText : '',
      'people',
      searchType,
      queryUnderstanding,
    );

    this.logger.log(`Strategy planning user prompt: ${strategyPlanningUserPrompt}`);

    const multiStrategyResult = await this.streamPeopleSearchParametersWithStrategies(
      openaiClient,
      strategyPlanningSystemPrompt,
      strategyPlanningUserPrompt,
      userMessage,
      rawJDText,
      searchType,
      sendEvent,
      includeJd,
      queryUnderstanding,
    );

    if (multiStrategyResult) {
      this.logger.log(`Multi-strategy ${searchType} people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
      return multiStrategyResult;
    }

    this.logger.warn(`Multi-strategy ${searchType} people parameter generation returned no usable result.`);
    return null;
  }

  /**
   * Generates parameters using fallback single-call approach with user-prioritized prompt
   */
  async generateFallbackParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    // Include clarification answers in user message if available
    let enhancedUserMessage = userMessage;
    if (queryUnderstanding?.clarificationAnswers) {
      enhancedUserMessage = `${userMessage}\n\nClarification Answers: ${queryUnderstanding.clarificationAnswers}`;
    }
    
    const userPrioritizedPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
      enhancedUserMessage,
      includeJd ? rawJDText : '',
      'people',
      searchType
    );
    
    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      parameterGenerationSystemPrompt,
      userPrioritizedPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Generates parameters using standard prompt (no user message)
   */
  async generateStandardParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    rawJDText: string | undefined,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const prompt = this.searchParametersPrompts.getPeopleSearchPrompt(
      searchType,
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
      false, // Generate user prompt
    );
    
    this.logger.log(`Prompt after template replacement for ${searchType} people search: ${prompt.user.substring(0, 500)}...`);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      prompt.system,
      prompt.user,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Generates parameters using a single prompt call
   */
  async generateSingleCallParameters(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    return await this.streamPeopleSearchParametersWithSinglePrompt(
      openaiClient,
      systemPrompt,
      userPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    ) as any;
  }

  /**
   * Generic function to stream people search parameters with a single prompt
   */
  async streamPeopleSearchParametersWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    
    if (searchType === 'classic') {
      console.log(`Messages for classic people search: ${JSON.stringify(messages, null, 2)} ${userPrompt} }`);
    }
    
    sendEvent?.('status', { message: 'Analyzing job requirements and generating search parameters...' });
    
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
    
    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      messages,
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} People Search Parameters: ${JSON.stringify(result, null, 2)}`);

    // Post-process to remove redundant filters
    if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      this.removeRedundantFilters(result as any, searchType);
    }

    // Fallback: if the model returned an empty object, synthesize minimal parameters from the JD (only for classic)
    if (searchType === 'classic' && (!result || (typeof result === 'object' && Object.keys(result).length === 0))) {
      sendEvent?.('status', { message: 'Using fallback parameters...' });
      const synthesized = {
        keywords:
          (Array.isArray(parsedJobDescription.keywords) && parsedJobDescription.keywords.length > 0
            ? parsedJobDescription.keywords.join(' ')
            : parsedJobDescription.jobTitle) || null,
        industry: parsedJobDescription.industry ? [parsedJobDescription.industry] : null,
        location: parsedJobDescription.location ? [parsedJobDescription.location] : null,
        profile_language: null,
        network_distance: null,
        company: null,
        past_company: null,
        school: null,
        service: null,
        connections_of: null,
        followers_of: null,
        open_to: null,
        advanced_keywords: {
          first_name: null,
          last_name: null,
          title: null,
          company: null,
          school: null,
        },
      } as any;
      this.logger.warn('LLM returned empty classic people search parameters. Using synthesized fallback.');
      return synthesized;
    }

    return result;
  }

  /**
   * Generic function to stream people search parameters with strategies
   */
  async streamPeopleSearchParametersWithStrategies(
    openaiClient: OpenAI,
    strategyPlanningSystemPrompt: string,
    strategyPlanningUserPrompt: string,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
    | null
  > {
    try {
      sendEvent?.('status', { message: 'Planning search strategy...' });
      
      let strategyPlanSchema: any;
      let schemaName: string;
      
      switch (searchType) {
        case 'classic':
          strategyPlanSchema = classicPeopleStrategyPlanSchema;
          schemaName = 'classicPeopleStrategyPlan';
          break;
        case 'sales_navigator':
          strategyPlanSchema = salesNavigatorPeopleStrategyPlanSchema;
          schemaName = 'salesNavigatorPeopleStrategyPlan';
          break;
        case 'recruiter':
          strategyPlanSchema = recruiterPeopleStrategyPlanSchema;
          schemaName = 'recruiterPeopleStrategyPlan';
          break;
      }
      
      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: strategyPlanningSystemPrompt },
          { role: 'user' as const, content: strategyPlanningUserPrompt },
        ],
        zodResponseFormat(strategyPlanSchema, schemaName),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: ClassicPeopleStrategyPlan | SalesNavigatorPeopleStrategyPlan | RecruiterPeopleStrategyPlan | null = null;
      try {
        const parsed = JSON.parse(fullContent);
        switch (searchType) {
          case 'classic':
            strategyPlan = parsed as ClassicPeopleStrategyPlan;
            break;
          case 'sales_navigator':
            strategyPlan = parsed as SalesNavigatorPeopleStrategyPlan;
            break;
          case 'recruiter':
            strategyPlan = parsed as RecruiterPeopleStrategyPlan;
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to parse ${searchType} people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      let strategyResults: ClassicPeopleSearchStrategyResult[] | SalesNavigatorPeopleSearchStrategyResult[] | RecruiterPeopleSearchStrategyResult[];

      switch (searchType) {
        case 'classic':
          strategyResults = [] as ClassicPeopleSearchStrategyResult[];
          break;
        case 'sales_navigator':
          strategyResults = [] as SalesNavigatorPeopleSearchStrategyResult[];
          break;
        case 'recruiter':
          strategyResults = [] as RecruiterPeopleSearchStrategyResult[];
          break;
      }

      // Use parameter generation system prompt (not strategy system prompt) for individual parameter generation
      const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);

      for (const strategy of strategyPlan.strategies) {
        const eventResult = sendEvent?.('status', { message: `Generating parameters for strategy: ${strategy.label}...` });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping strategy parameter generation');
          break;
        }
        
        if (!queryUnderstanding) {
          this.logger.warn('Query understanding not available, skipping validation steps.');
        }
        
        let strategyOutcome = await this.streamPeopleParametersForStrategy(
          openaiClient,
          parameterGenerationSystemPrompt,
          strategy,
          userMessage,
          rawJDText,
          searchType,
          sendEvent,
          includeJd,
          queryUnderstanding,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        // Validate and optimize parameters if query understanding is available
        if (queryUnderstanding) {
          const validationResult = await this.resultValidationService.validateParameterCoherence(
            openaiClient,
            strategyOutcome.parameters,
            queryUnderstanding,
            strategy,
            searchType,
            sendEvent,
          );

          if (!validationResult.isCoherent || validationResult.estimatedResultCount === 'low') {
            const eventResult = sendEvent?.('status', { message: `Optimizing parameters for strategy: ${strategy.label}...` });
            if (eventResult === false) {
              this.logger.log('Stream aborted, skipping parameter optimization');
              break;
            }
            const optimizedParameters = await this.resultValidationService.optimizeParameters(
              openaiClient,
              strategyOutcome.parameters,
              queryUnderstanding,
              strategy,
              validationResult,
              searchType,
              sendEvent,
            );
            strategyOutcome.parameters = optimizedParameters;
          }
        }

        const strategyResult = {
          id: strategy.id,
          label: strategy.label,
          goal: strategy.goal,
          aggressiveness: strategy.aggressiveness,
          description: strategy.description,
          whenToUse: strategy.whenToUse,
          estimatedCandidateCount: strategy.estimatedCandidateCount,
          filterFocus: strategy.filterFocus,
          parameterRationales: strategyOutcome.parameterRationales,
          parameters: strategyOutcome.parameters,
        };

        if (searchType === 'classic') {
          (strategyResults as ClassicPeopleSearchStrategyResult[]).push(strategyResult as ClassicPeopleSearchStrategyResult);
        } else if (searchType === 'sales_navigator') {
          (strategyResults as SalesNavigatorPeopleSearchStrategyResult[]).push(strategyResult as SalesNavigatorPeopleSearchStrategyResult);
        } else {
          (strategyResults as RecruiterPeopleSearchStrategyResult[]).push(strategyResult as RecruiterPeopleSearchStrategyResult);
        }
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      if (searchType === 'classic') {
        return {
          primary: primaryStrategy.parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as ClassicPeopleSearchStrategyResult[],
        };
      } else if (searchType === 'sales_navigator') {
        return {
          primary: primaryStrategy.parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as SalesNavigatorPeopleSearchStrategyResult[],
        };
      } else {
        return {
          primary: primaryStrategy.parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as RecruiterPeopleSearchStrategyResult[],
        };
      }
    } catch (error) {
      this.logger.error(`Multi-strategy ${searchType} people parameter generation failed: ${error}`);
      return null;
    }
  }

  /**
   * Generate parameters from strategy text (new text-based approach)
   * Interprets natural language strategy text to generate all parameters in one call
   */
  async streamPeopleParametersFromStrategyText(
    openaiClient: OpenAI,
    strategyText: string,
    queryUnderstandingText: string,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<{
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
      | null;
    parameterRationales: Record<string, string>;
  } | null> {
    const eventResult = sendEvent?.('status', { message: 'Generating parameters from strategy...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during parameter generation from strategy text');
      return null;
    }

    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    const parameterGenerationPrompt = this.searchParametersPrompts.buildParameterGenerationPromptFromStrategyText(
      strategyText,
      queryUnderstandingText,
      userMessage,
      includeJd ? rawJDText : '',
      searchType,
    );

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

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: parameterGenerationSystemPrompt },
        { role: 'user' as const, content: parameterGenerationPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    if (!fullContent) {
      this.logger.warn('Parameter generation from strategy text returned empty content.');
      return null;
    }

    try {
      const parsed = JSON.parse(fullContent);
      const validated = schema.parse(parsed);
      
      // Post-process to remove redundant filters
      this.removeRedundantFilters(validated, searchType);

      // Generate parameter rationales from strategy text
      const parameterRationales: Record<string, string> = {};
      // Extract which parameters were mentioned in strategy text
      const strategyLower = strategyText.toLowerCase();
      if (strategyLower.includes('keyword')) {
        parameterRationales['keywords'] = 'Keywords generated based on strategy: ' + strategyText;
      }
      if (strategyLower.includes('location')) {
        parameterRationales['location'] = 'Location generated based on strategy: ' + strategyText;
      }
      if (strategyLower.includes('industry')) {
        parameterRationales['industry'] = 'Industry generated based on strategy: ' + strategyText;
      }
      if (strategyLower.includes('company')) {
        parameterRationales['company'] = 'Company generated based on strategy: ' + strategyText;
      }

      if (!validated.keywords) {
        this.logger.warn('Generated parameters missing keywords, which are required.');
        return null;
      }

      return {
        parameters: validated,
        parameterRationales,
      };
    } catch (error) {
      this.logger.error(`Failed to parse parameters from strategy text: ${error}`);
      return null;
    }
  }

  /**
   * Generic function to stream people parameters for a specific strategy
   * @deprecated This method uses structured strategy definitions. Use streamPeopleParametersFromStrategyText for text-based strategies.
   */
  async streamPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<{
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
      | null;
    parameterRationales: Record<string, string>;
  } | null> {
    let aggregatedResult: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
    let parameterDecisions: ClassicPeopleParameterSelection | SalesNavigatorPeopleParameterSelection | RecruiterPeopleParameterSelection;
    let parameterRationales: Record<ClassicPeopleParameterName, string> | Record<SalesNavigatorPeopleParameterName, string> | Record<RecruiterPeopleParameterName, string>;
    let parameterSchemaMap: Record<string, any>;
    let assignParameterValue: (target: any, param: string, value: unknown) => void;

    switch (searchType) {
      case 'classic': {
        aggregatedResult = createClassicPeopleBaseResult();
        parameterDecisions = (strategy as ClassicPeopleStrategyDefinition).parameterSelection ?? buildDefaultParameterSelection();
        parameterSchemaMap = classicPeopleParameterSchemaMap;
        assignParameterValue = assignClassicPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as ClassicPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<ClassicPeopleParameterName, string>,
        );
        break;
      }
      case 'sales_navigator': {
        aggregatedResult = createSalesNavigatorPeopleBaseResult();
        parameterDecisions = (strategy as SalesNavigatorPeopleStrategyDefinition).parameterSelection ?? buildDefaultSalesNavigatorPeopleParameterSelection();
        parameterSchemaMap = salesNavigatorPeopleParameterSchemaMap;
        assignParameterValue = assignSalesNavigatorPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as SalesNavigatorPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<SalesNavigatorPeopleParameterName, string>,
        );
        break;
      }
      case 'recruiter': {
        aggregatedResult = createRecruiterPeopleBaseResult();
        parameterDecisions = (strategy as RecruiterPeopleStrategyDefinition).parameterSelection ?? buildDefaultRecruiterPeopleParameterSelection();
        parameterSchemaMap = recruiterPeopleParameterSchemaMap;
        assignParameterValue = assignRecruiterPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as RecruiterPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<RecruiterPeopleParameterName, string>,
        );
        break;
      }
    }

    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parametersToGenerate = Object.entries(parameterDecisions).filter(
      ([, decision]) => (decision as ClassicPeopleParameterDecision | SalesNavigatorPeopleParameterDecision | RecruiterPeopleParameterDecision).shouldGenerate
    ) as Array<[string, ClassicPeopleParameterDecision | SalesNavigatorPeopleParameterDecision | RecruiterPeopleParameterDecision]>;

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      const eventResult = sendEvent?.('status', { message: `Generating ${parameterName} parameter...: ` });
      if (eventResult === false) {
        this.logger.log('Stream aborted, stopping parameter generation');
        break;
      }
      
      const generationPrompt = this.searchParametersPrompts.buildPeopleParameterGenerationPrompt(
        parameterName as ClassicPeopleParameterName | SalesNavigatorPeopleParameterName | RecruiterPeopleParameterName,
        searchType,
        {
          userMessage,
          rawJDText: includeJd ? rawJDText : '',
          selectionReasoning: decision.reasoning,
          strategyLabel: strategy.label,
          strategyGoal: strategy.goal,
          strategyAggressiveness: strategy.aggressiveness,
          estimatedCandidateRange: candidateRange,
        },
      );

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: generationPrompt },
        ],
        zodResponseFormat(
          parameterSchemaMap[parameterName],
          `${searchType === 'classic' ? 'classic' : searchType === 'sales_navigator' ? 'salesNavigator' : 'recruiter'}People${parameterName}Parameter`,
        ),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(fullContent) as Record<string, unknown>;
        assignParameterValue(
          aggregatedResult,
          parameterName,
          parsedParameter[parameterName],
        );
        generatedAny = true;
      } catch (error) {
        this.logger.error(`Failed to parse generated ${parameterName} parameter: ${error}`);
      }
    }

    if (!generatedAny || !aggregatedResult.keywords) {
      this.logger.warn(`Strategy "${strategy.label}" did not produce usable parameter values.`);
      return null;
    }

    // Post-process to remove redundant filters
    this.removeRedundantFilters(aggregatedResult, searchType);

    return {
      parameters: aggregatedResult,
      parameterRationales,
    };
  }

  /**
   * Generic function to stream companies search parameters
   */
  async streamCompaniesSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator',
    userMessage?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>
  > {
    let prompt: { system: string; user: string };
    let schema: any;
    let schemaName: string;
    
    prompt = this.searchParametersPrompts.getCompaniesSearchPrompt(
      searchType,
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
    ) as { system: string; user: string };
    switch (searchType) {
      case 'classic':
        schema = classicCompaniesSearchSchema;
        schemaName = 'classicCompaniesSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorCompaniesSearchSchema;
        schemaName = 'salesNavigatorCompaniesSearch';
        break;
    }
    
    let enhancedUserPrompt: string;
    
    if (userMessage) {
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'companies',
        searchType
      );
    } else {
      // Template variables are already replaced in getCompaniesSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Stream generation of LinkedIn Classic Jobs Search parameters
   */
  async streamJobsSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.searchParametersPrompts.getJobsSearchPrompt(
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
    );
    
    let enhancedUserPrompt: string;
    
    if (userMessage) {
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'jobs',
        'classic'
      );
    } else {
      // Template variables are already replaced in getJobsSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating job search parameters...' });

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    return fullContent ? JSON.parse(fullContent) : {};
  }

  /**
   * Generate hierarchical search strategies for executive/leadership roles
   * Creates multiple search strategies with different role/industry combinations
   */
  async generateHierarchicalSearchStrategies(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    apiToken?: string,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  > {
    sendEvent?.('status', { message: 'Generating hierarchical search strategies...' });

    const hierarchicalPrompt = this.searchParametersPrompts.buildHierarchicalSearchStrategyPrompt(
      queryUnderstanding,
      userMessage,
    );

    try {
      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          {
            role: 'system' as const,
            content: 'You are an expert at generating hierarchical search strategies for executive recruitment. Create multi-level search strategies that expand from exact matches to broader matches.',
          },
          { role: 'user' as const, content: hierarchicalPrompt },
        ],
        zodResponseFormat(hierarchicalSearchStrategySchema, 'hierarchicalSearchStrategy'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Hierarchical search strategy generation returned empty content, falling back to focused search.');
        return await this.generateFocusedSearchWithIndependentParameters(
          openaiClient,
          parsedJobDescription,
          queryUnderstanding,
          userMessage,
          // 'Hierarchical search generation failed, using focused search',
          rawJDText,
          searchType,
          sendEvent,
          includeJd,
        ).then(params => this.wrapParametersAsResult(params, searchType));
      }

      const parsed = JSON.parse(fullContent);
      const hierarchicalStrategy = hierarchicalSearchStrategySchema.parse(parsed);

      this.logger.log(`Generated hierarchical search strategy with ${hierarchicalStrategy.strategies.length} levels: ${hierarchicalStrategy.expansionPath}`);

      // Generate search parameters for each strategy level
      const strategyResults: Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult> = [];

      for (const strategyLevel of hierarchicalStrategy.strategies.sort((a, b) => a.priority - b.priority)) {
        sendEvent?.('status', { 
          message: `Generating search parameters for level ${strategyLevel.level}: ${strategyLevel.role} in ${strategyLevel.industryScope}` 
        });

        // Create modified query understanding for this level
        const levelQueryUnderstanding: QueryUnderstanding = {
          ...queryUnderstanding,
          primaryRole: strategyLevel.role,
          roleVariations: strategyLevel.roleVariations,
          industry: strategyLevel.industryScope.includes('allied') 
            ? queryUnderstanding.industry?.map(ind => {
                // Map to allied industries based on recruiting knowledge
                if (ind.toLowerCase().includes('ceramics')) {
                  return 'Glass, Ceramics & Concrete';
                }
                return ind;
              }) || null
            : queryUnderstanding.industry,
        };

        // Generate parameters for this level
        const levelParams = await this.generateFocusedSearchWithIndependentParameters(
          openaiClient,
          parsedJobDescription,
          levelQueryUnderstanding,
          userMessage,
          // `Hierarchical level ${strategyLevel.level}: ${strategyLevel.reasoning}`,
          rawJDText,
          searchType,
          sendEvent,
          includeJd,
        );

        // Create strategy result
        const strategyResult = this.searchStrategyService.createStrategyResultFromParameters(
          levelParams,
          searchType,
          {
            id: `hierarchical-level-${strategyLevel.level}`,
            label: `Level ${strategyLevel.level}: ${strategyLevel.role}`,
            goal: strategyLevel.reasoning,
            aggressiveness: strategyLevel.level === 0 ? 'focused' : 'balanced' as const,
            description: `Hierarchical search level ${strategyLevel.level} - ${strategyLevel.role} in ${strategyLevel.industryScope}`,
            whenToUse: `Use when exact match (level 0) is insufficient`,
            estimatedCandidateCount: {
              minimum: strategyLevel.estimatedCandidateCount || 20,
              maximum: (strategyLevel.estimatedCandidateCount || 20) * 2,
            },
            filterFocus: `Role: ${strategyLevel.role}, Industry: ${strategyLevel.industryScope}`,
          },
        );

        strategyResults.push(strategyResult);
      }

      // Return primary (level 0) and strategies
      const primaryStrategy = strategyResults.find(s => s.id === 'hierarchical-level-0');
      const otherStrategies = strategyResults.filter(s => s.id !== 'hierarchical-level-0');

      if (searchType === 'classic') {
        return {
          primary: primaryStrategy?.parameters || {} as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies as ClassicPeopleSearchStrategyResult[],
        } as ClassicPeopleSearchGenerationResult;
      } else if (searchType === 'sales_navigator') {
        return {
          primary: primaryStrategy?.parameters || {} as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies as SalesNavigatorPeopleSearchStrategyResult[],
        } as SalesNavigatorPeopleSearchGenerationResult;
      } else {
        return {
          primary: primaryStrategy?.parameters || {} as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies as RecruiterPeopleSearchStrategyResult[],
        } as RecruiterPeopleSearchGenerationResult;
      }
    } catch (error) {
      this.logger.error(`Failed to generate hierarchical search strategies: ${error}`);
      // Fallback to focused search
      return await this.generateFocusedSearchWithIndependentParameters(
        openaiClient,
        parsedJobDescription,
        queryUnderstanding,
        userMessage,
        // 'Hierarchical search generation failed, using focused search',
        rawJDText,
        searchType,
        sendEvent,
        includeJd,
      ).then(params => this.wrapParametersAsResult(params, searchType));
    }
  }

  /**
   * Generate refined keywords using domain-aware approach
   */
  async generateRefinedKeywords(
    openaiClient: OpenAI,
    queryUnderstanding: QueryUnderstanding,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<string> {
    sendEvent?.('status', { message: 'Generating refined keywords with enhanced schema...' });
    
    const keywordPrompt = this.searchParametersPrompts.buildEnhancedKeywordPrompt(
      queryUnderstanding,
      {
        label: strategy.label,
        aggressiveness: strategy.aggressiveness,
        goal: strategy.goal,
      },
      searchType,
    );

    try {
      // Use enhanced keyword schema to get structured keywords
      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert at generating precise LinkedIn search keywords that prioritize critical non-title requirements (certifications, technologies) while maintaining role title focus. Use the enhanced keyword schema to structure your output.' 
          },
          { role: 'user' as const, content: keywordPrompt },
        ],
        zodResponseFormat(enhancedKeywordSchema, 'enhancedKeywords'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Enhanced keyword generation returned empty content, falling back to simple keywords.');
        // Fallback to simple keyword generation
        return this.generateSimpleKeywords(queryUnderstanding, searchType);
      }

      const parsed = JSON.parse(fullContent);
      const enhancedKeywords = enhancedKeywordSchema.parse(parsed);

      // Combine keywords into boolean string
      const combinedKeywords = this.combineEnhancedKeywords(enhancedKeywords, searchType);
      this.logger.log(`Generated enhanced keywords: ${combinedKeywords}`);
      return combinedKeywords;
    } catch (error) {
      this.logger.error(`Failed to generate enhanced keywords: ${error}, falling back to simple keywords.`);
      // Fallback to simple keyword generation
      return this.generateSimpleKeywords(queryUnderstanding, searchType);
    }
  }

  /**
   * Combine enhanced keywords into a boolean keyword string
   */
  combineEnhancedKeywords(
    enhancedKeywords: z.infer<typeof enhancedKeywordSchema>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const keywordParts: string[] = [];

    // Primary keywords (job titles) - these are the main keywords
    if (enhancedKeywords.primaryKeywords.length > 0) {
      if (enhancedKeywords.primaryKeywords.length === 1) {
        keywordParts.push(`"${enhancedKeywords.primaryKeywords[0]}"`);
      } else {
        // Combine multiple primary keywords with OR
        const primaryKeywordsStr = enhancedKeywords.primaryKeywords
          .map(kw => `"${kw}"`)
          .join(' OR ');
        keywordParts.push(`(${primaryKeywordsStr})`);
      }
    }

    // For classic search, we have limited keywords, so prioritize primary keywords
    // For Sales Navigator/Recruiter, we can include more
    if (searchType !== 'classic') {
      // Add certification keywords if available
      if (enhancedKeywords.certificationKeywords && enhancedKeywords.certificationKeywords.length > 0) {
        const certKeywordsStr = enhancedKeywords.certificationKeywords
          .map(kw => `"${kw}"`)
          .join(' OR ');
        keywordParts.push(`(${certKeywordsStr})`);
      }

      // Add technology keywords if available
      if (enhancedKeywords.technologyKeywords && enhancedKeywords.technologyKeywords.length > 0) {
        const techKeywordsStr = enhancedKeywords.technologyKeywords
          .map(kw => `"${kw}"`)
          .join(' OR ');
        keywordParts.push(`(${techKeywordsStr})`);
      }

      // Add regulatory keywords if available
      if (enhancedKeywords.regulatoryKeywords && enhancedKeywords.regulatoryKeywords.length > 0) {
        const regKeywordsStr = enhancedKeywords.regulatoryKeywords
          .map(kw => `"${kw}"`)
          .join(' OR ');
        keywordParts.push(`(${regKeywordsStr})`);
      }
    }

    // Combine all parts with OR (candidates matching any part)
    const finalKeywords = keywordParts.join(' OR ');

    // For classic search, if we have advanced keywords, note them (they'll be used in advanced_keywords field)
    if (searchType === 'classic' && enhancedKeywords.advancedKeywords && enhancedKeywords.advancedKeywords.length > 0) {
      this.logger.log(`Advanced keywords for classic search: ${enhancedKeywords.advancedKeywords.join(', ')}`);
      // These will be handled separately in parameter generation
    }

    return finalKeywords || enhancedKeywords.primaryKeywords[0] || '';
  }

  /**
   * Generate simple keywords as fallback
   */
  generateSimpleKeywords(
    queryUnderstanding: QueryUnderstanding,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const maxKeywords = searchType === 'classic' ? 6 : 10;
    const roleVariations = queryUnderstanding.roleVariations.slice(0, maxKeywords);
    
    if (roleVariations.length === 1) {
      return `"${roleVariations[0]}"`;
    } else if (roleVariations.length > 1) {
      const keywordsStr = roleVariations.map(kw => `"${kw}"`).join(' OR ');
      return `(${keywordsStr})`;
    }
    
    return `"${queryUnderstanding.primaryRole}"`;
  }

  /**
   * Post-process parameters to remove redundant filters
   * Removes industry filter when company filter is present (company is more precise)
   */
  removeRedundantFilters(
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): void {
    // Remove industry filter if company filter is present (company is more precise)
    if (searchType === 'classic') {
      const classicParams = parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = classicParams.company && Array.isArray(classicParams.company) && classicParams.company.length > 0;
      const hasPastCompany = classicParams.past_company && Array.isArray(classicParams.past_company) && classicParams.past_company.length > 0;
      
      if ((hasCompany || hasPastCompany) && classicParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present (company: ${hasCompany ? classicParams.company?.join(', ') : 'none'}, past_company: ${hasPastCompany ? classicParams.past_company?.join(', ') : 'none'})`);
        classicParams.industry = undefined;
      }
    } else if (searchType === 'sales_navigator') {
      const salesNavParams = parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = salesNavParams.company && 
        ((salesNavParams.company.include && salesNavParams.company.include.length > 0) || 
         (salesNavParams.company.exclude && salesNavParams.company.exclude.length > 0));
      const hasPastCompany = salesNavParams.past_company && 
        ((salesNavParams.past_company.include && salesNavParams.past_company.include.length > 0) || 
         (salesNavParams.past_company.exclude && salesNavParams.past_company.exclude.length > 0));
      
      if ((hasCompany || hasPastCompany) && salesNavParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present`);
        salesNavParams.industry = undefined;
      }
    } else {
      // recruiter
      const recruiterParams = parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = recruiterParams.company && Array.isArray(recruiterParams.company) && recruiterParams.company.length > 0;
      const hasPastCompany = recruiterParams.past_company && Array.isArray(recruiterParams.past_company) && recruiterParams.past_company.length > 0;
      
      if ((hasCompany || hasPastCompany) && recruiterParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present`);
        recruiterParams.industry = undefined;
      }
    }
  }

  /**
   * Wraps generated parameters in the appropriate result type
   */
  wrapParametersAsResult(
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): 
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  {
    if (searchType === 'classic') {
      return { primary: parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> };
    } else if (searchType === 'sales_navigator') {
      return { primary: parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> };
    } else {
      return { primary: parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> };
    }
  }
}


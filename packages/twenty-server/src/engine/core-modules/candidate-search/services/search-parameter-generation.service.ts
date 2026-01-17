import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { QueryUnderstanding } from 'src/engine/core-modules/candidate-search/schemas/query-understanding.schema';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { BooleanQueryBuilderResult, booleanQueryBuilderSchema } from '../schemas/boolean-query-builder.schema';
import { classicCompaniesSearchSchema } from '../schemas/classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/classic-jobs-search.schema';
import {
  classicPeopleSearchSchema
} from '../schemas/classic-people-search.schema';
import {
  recruiterPeopleSearchSchema
} from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import {
  salesNavigatorPeopleSearchSchema
} from '../schemas/sales-navigator-people-search.schema';
import {
  ClassicPeopleSearchStrategyResult,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import { TokenUsage } from '../utils/token-tracking.util';
import { DiscoveryService } from './discovery.service';
import { SearchStrategyService } from './search-strategy.service';
import { StreamProcessingService } from './stream-processing.service';

type PeopleSearchGenerationResult<T> = {
  strategies: T[];
};

@Injectable()
export class SearchParameterGenerationService {
  private readonly logger = new Logger(SearchParameterGenerationService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly searchStrategyService: SearchStrategyService,
    private readonly discoveryService: DiscoveryService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  /**
   * Main entry point for generating people search parameters with strategies
   * Uses multi-strategy approach based on query understanding and user message
   * Requires both userMessage and queryUnderstanding to be provided
   */
  // async generateUnresolvedPeopleSearchParams(
  //   parsedJobDescription: ParsedJobDescription,
  //   openaiClient: OpenAI,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   userMessage?: string,
  //   rawJDText?: string,
  //   sendEvent?: (event: string, data: any) => boolean | void,
  //   includeJd: boolean = true,
  //   queryUnderstanding?: QueryUnderstanding,
  //   apiToken?: string,
  //   model: string = 'gpt-5.1-chat-latest',
  //   onTokenUsage?: (usage: TokenUsage) => void,
  // ): Promise<
  //   | PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>
  //   | PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>
  //   | PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>
  // > {
  //   if (!userMessage || !queryUnderstanding) {
  //     throw new Error(
  //       'userMessage and queryUnderstanding are required for generating people search parameters',
  //     );
  //   }

  //   return this.generateMultiStrategyPeopleSearchParams(
  //     parsedJobDescription,
  //     openaiClient,
  //     searchType,
  //     userMessage,
  //     rawJDText,
  //     sendEvent,
  //     includeJd,
  //     queryUnderstanding,
  //     apiToken,
  //     model,
  //     onTokenUsage,
  //   );
  // }

  /**
   * Generate people search parameters using multi-strategy approach
   * Handles strategy generation, concurrent parameter generation, and result processing
   */
  async generateUnresolvedPeopleSearchParams(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    userMessage: string,
    rawJDText: string,
    sendEvent: ((event: string, data: any) => boolean | void) | undefined,
    includeJd: boolean,
    queryUnderstanding: QueryUnderstanding,
    apiToken: string,
    model: string,
    onTokenUsage: ((usage: TokenUsage) => void) | undefined,
  ): Promise<
    | PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>
  > {
    const queryUnderstandingText = this.searchStrategyService.formatQueryUnderstandingAsText(
      queryUnderstanding,
      userMessage,
    );

    const strategyTexts = await this.searchStrategyService.generateStrategies(
      openaiClient,
      queryUnderstandingText,
      userMessage,
      searchType,
      queryUnderstanding,
      sendEvent,
      model,
      onTokenUsage,
    );

    this.logger.log(`Generated ${strategyTexts.length} search strategies as text: ${JSON.stringify(strategyTexts, null, 2)} for model ${model}`);
    const eventResult = sendEvent?.('status', {
      message: `Generating parameters for ${strategyTexts.length} strategies concurrently...`,
    });
    
    if (eventResult === false) {
      this.logger.log('Stream aborted, stopping strategy parameter generation');
      return this.createEmptyStrategyResult(searchType);
    }

    const parameterPromises = strategyTexts.map((strategy, i) =>
      this.generateParamsFromStrategy(
        openaiClient,
        strategy.strategyText,
        queryUnderstandingText,
        userMessage,
        rawJDText,
        searchType,
        sendEvent,
        includeJd,
        onTokenUsage,
      ).then((result) => ({ index: i, strategy, result })),
    );

    const parameterResults = await Promise.allSettled(parameterPromises);
    const strategyResults = await this.processStrategyParameterResults(
      parameterResults,
      queryUnderstanding,
      queryUnderstandingText,
      userMessage,
      searchType,
      openaiClient,
      sendEvent,
      apiToken,
      model,
    );

    return this.wrapStrategyResults(strategyResults, searchType);
  }

  private async processStrategyParameterResults(
    parameterResults: PromiseSettledResult<{ index: number; strategy: { label?: string; strategyText: string }; result: { parameters: any } | null }>[],
    queryUnderstanding: QueryUnderstanding,
    queryUnderstandingText: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    openaiClient: OpenAI,
    sendEvent: ((event: string, data: any) => boolean | void) | undefined,
    apiToken: string,
    model: string,
  ): Promise<Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult>> {
    const strategyResults: Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult> = [];

    for (let i = 0; i < parameterResults.length; i++) {
      const settledResult = parameterResults[i];

      if (settledResult.status === 'rejected') {
        this.logger.warn(`Strategy ${i + 1} parameter generation failed: ${settledResult.reason}`);
        continue;
      }

      const { index, strategy, result: parameterResult } = settledResult.value;
      if (!parameterResult || !parameterResult.parameters) {
        this.logger.warn(`Strategy ${index + 1} did not produce usable parameters`);
        continue;
      }

      await this.generateSophisticatedBooleanQuery(
        queryUnderstanding,
        searchType,
        apiToken,
        sendEvent,
      );

      const strategyMetadata = this.createStrategyMetadata(
        index,
        strategy,
        userMessage,
        queryUnderstanding,
      );

      const processedStrategies = await this.buildStrategyResultsFromParameters(
        parameterResult.parameters,
        strategyMetadata,
        queryUnderstandingText,
        userMessage,
        searchType,
        openaiClient,
        sendEvent,
        model,
      );

      strategyResults.push(...processedStrategies);
    }

    return strategyResults;
  }

  /**
   * Build strategy results from parameters
   */
  private async buildStrategyResultsFromParameters(
    parameters: any,
    strategyMetadata: {
      id: string;
      label: string;
      description: string;
      strategyText: string;
      originalUserQuery: string;
      clarificationQuestions: any;
      clarificationAnswers: any;
    },
    queryUnderstandingText: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    openaiClient: OpenAI,
    sendEvent: ((event: string, data: any) => boolean | void) | undefined,
    model: string,
  ): Promise<Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult>> {
    if (searchType === 'classic') {
      const keywordTermCount = this.countKeywordTerms(parameters.keywords);

      if (keywordTermCount > 6) {
        this.logger.warn(
          `Strategy has ${keywordTermCount} keyword terms (exceeds 6-term limit for Classic). Skipping strategy. Keywords: "${parameters.keywords}". The sophisticated boolean query generation should have optimized this to <= 6 terms.`,
        );
        sendEvent?.('status', {
          message: `Skipping strategy with ${keywordTermCount} terms (exceeds Classic 6-term limit)`,
        });
        return [];
      }
    }

    const strategyResult = this.searchStrategyService.buildStrategyResult(
      parameters,
      searchType,
      strategyMetadata,
    );
    return [strategyResult];
  }

  /**
   * Create strategy metadata from strategy and query understanding
   */
  private createStrategyMetadata(
    index: number,
    strategy: { label?: string; strategyText: string },
    userMessage: string,
    queryUnderstanding: QueryUnderstanding,
  ): {
    id: string;
    label: string;
    description: string;
    strategyText: string;
    originalUserQuery: string;
    clarificationQuestions: any;
    clarificationAnswers: any;
  } {
    return {
      id: `strategy-${index + 1}`,
      label: strategy.label || `Strategy ${index + 1}`,
      description: strategy.strategyText,
      strategyText: strategy.strategyText, // Preserve original strategy text as guideline
      originalUserQuery: userMessage, // Preserve original user query for traceability
      clarificationQuestions: queryUnderstanding?.clarificationQuestions || null, // Preserve clarification questions for traceability
      clarificationAnswers: queryUnderstanding?.clarificationAnswers || null, // Preserve clarification answers for traceability
    };
  }

  /**
   * Create empty strategy result based on search type
   */
  private createEmptyStrategyResult(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ):
    | PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult> {
    if (searchType === 'classic') {
      return { strategies: [] } as PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>;
    }
    if (searchType === 'sales_navigator') {
      return { strategies: [] } as PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>;
    }
    return { strategies: [] } as PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>;
  }

  /**
   * Wrap strategy results in the appropriate result type
   */
  private wrapStrategyResults(
    strategyResults: Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ):
    | PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult> {
    if (searchType === 'classic') {
      return {
        strategies: strategyResults as ClassicPeopleSearchStrategyResult[],
      } as PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>;
    }
    if (searchType === 'sales_navigator') {
      return {
        strategies: strategyResults as SalesNavigatorPeopleSearchStrategyResult[],
      } as PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>;
    }
    return {
      strategies: strategyResults as RecruiterPeopleSearchStrategyResult[],
    } as PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>;
  }




  async generateParamsFromStrategy(
    openaiClient: OpenAI,
    strategyText: string,
    queryUnderstandingText: string,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<{
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
      | null; 
  } | null> {
    const eventResult = sendEvent?.('status', { message: 'Generating parameters from strategy...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during parameter generation from strategy text');
      return null;
    }

    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getParameterGenerationFromStrategySystemPrompt(searchType);
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

    const streamResult = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
    const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

    // Accumulate token usage if available
    if (typeof streamResult !== 'string' && streamResult.usage && onTokenUsage) {
      onTokenUsage(streamResult.usage);
    }

    if (!fullContent) {
      this.logger.warn('Parameter generation from strategy text returned empty content.');
      return null;
    }

    try {
      const parsed = JSON.parse(fullContent);
      const validated = schema.parse(parsed);
      
      // Post-process to remove redundant filters
      this.removeRedundantFilters(validated, searchType);

      if (!validated.keywords) {
        this.logger.warn('Generated parameters missing keywords, which are required.');
        return null;
      }

      return {
        parameters: validated,
      };
    } catch (error) {
      this.logger.error(`Failed to parse parameters from strategy text: ${error}`);
      return null;
    }
  }

  /**
   * Generate sophisticated boolean query for Classic, Sales Navigator, or Recruiter
   * Creates comprehensive boolean queries that capture different company nomenclatures
   * For Classic: Intelligently optimizes within 6-term constraint
   * For Sales Nav/Recruiter: Generates comprehensive queries with no term limits
   * 
   * Example: For "Head of Operations", generates:
   * (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))
   */
  private async generateSophisticatedBooleanQuery(
    queryUnderstanding: QueryUnderstanding,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<BooleanQueryBuilderResult | null> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const eventResult = sendEvent?.('status', { message: 'Generating sophisticated boolean query...' });
      if (eventResult === false) {
        this.logger.log('Stream aborted during boolean query generation');
        return null;
      }

      // Extract hierarchical and domain terms from discovered titles
      const hierarchicalTerms: string[] = [];
      const domainTerms: string[] = [];
      const nomenclaturePatterns: string[] = [];

      discoveredTitles?.jobTitles?.forEach(jobTitle => {
        if (jobTitle.hierarchicalTerms) {
          hierarchicalTerms.push(...jobTitle.hierarchicalTerms);
        }
        if (jobTitle.domainTerms) {
          domainTerms.push(...jobTitle.domainTerms);
        }
      });

      // Also extract from variations
      const allVariations = discoveredTitles?.jobTitles?.flatMap(jt => [jt.title, ...jt.variations]) || [];

      const systemPrompt = this.searchParametersPrompts.getBooleanQueryGenerationSystemPrompt(searchType);
      const prompt = this.searchParametersPrompts.getBooleanQueryGenerationUserPrompt(
        queryUnderstanding,
        allVariations,
        hierarchicalTerms,
        domainTerms,
        nomenclaturePatterns,
        searchType,
        queryUnderstanding.companyTypeSignals,
      );

      const completion = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(booleanQueryBuilderSchema, 'booleanQueryBuilder'),
      );

      const response = await this.streamProcessingService.processStreamChunks(completion, sendEvent);

      if (!response) {
        this.logger.warn('Boolean query generation returned empty content');
        return null;
      }

      const content = typeof response === 'string' ? response : response.content;
      if (!content) {
        this.logger.warn('Boolean query generation returned empty content');
        return null;
      }

      const parsed = JSON.parse(content);
      const result = booleanQueryBuilderSchema.parse(parsed);
      this.logger.log(`Generated sophisticated boolean query: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate sophisticated boolean query: ${error}`);
      return null;
    }
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
    onTokenUsage?: (usage: TokenUsage) => void,
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
    let systemPrompt: string;
    
    if (userMessage) {
      systemPrompt = this.searchParametersPrompts.getUserPrioritizedSystemPrompt(
        'companies',
        searchType
      );
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'companies',
        searchType
      );
    } else {
      systemPrompt = prompt.system;
      // Template variables are already replaced in getCompaniesSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const streamResult = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
    const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

    // Accumulate token usage if available
    if (typeof streamResult !== 'string' && streamResult.usage && onTokenUsage) {
      onTokenUsage(streamResult.usage);
    }

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
    let systemPrompt: string;
    
    if (userMessage) {
      systemPrompt = this.searchParametersPrompts.getUserPrioritizedSystemPrompt(
        'jobs',
        'classic'
      );
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'jobs',
        'classic'
      );
    } else {
      systemPrompt = prompt.system;
      // Template variables are already replaced in getJobsSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating job search parameters...' });

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    );

    const streamResult = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
    const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

    return fullContent ? JSON.parse(fullContent) : {};
  }


  /**
   * Count the number of keyword terms in a boolean keyword string
   * Terms are counted as: quoted phrases (each is 1 term) + unquoted words separated by boolean operators
   */
  countKeywordTerms(keywords: string | null | undefined): number {
    if (!keywords || typeof keywords !== 'string') {
      return 0;
    }

    // Count quoted strings (each quoted phrase is one term)
    const quotedMatches = keywords.match(/"([^"]+)"/g) || [];
    const quotedCount = quotedMatches.length;

    // Remove quoted strings and count remaining unquoted terms
    const unquotedText = keywords.replace(/"([^"]+)"/g, '');
    
    // Remove any remaining boolean operators and parentheses (they're not terms)
    // This handles cases where only quoted phrases are present with operators between them
    const cleanedUnquotedText = unquotedText
      .replace(/\s+(?:AND|OR|NOT)\s+/gi, ' ') // Replace operators with single space
      .replace(/[()]/g, '') // Remove parentheses
      .trim();
    
    // Split by whitespace and count non-empty parts
    const unquotedParts = cleanedUnquotedText
      .split(/\s+/)
      .filter(p => p.length > 0 && !p.match(/^(AND|OR|NOT)$/i)); // Filter out empty and standalone operators

    return quotedCount + unquotedParts.length;
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

}


import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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
  classicKeywordSplitSchema,
  ClassicPeopleParameterName,
  classicPeopleSearchSchema,
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
  QueryUnderstanding,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import { TokenUsage } from '../utils/token-tracking.util';
import { BooleanQueryBuilderService } from './boolean-query-builder.service';
import { DiscoveryService } from './discovery.service';
import { QueryUnderstandingService } from './query-understanding.service';
import { ResultValidationService } from './result-validation.service';
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
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly searchStrategyService: SearchStrategyService,
    private readonly resultValidationService: ResultValidationService,
    private readonly booleanQueryBuilderService: BooleanQueryBuilderService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  /**
   * Main entry point for generating people search parameters with strategies
   * Handles both multi-strategy (with user message) and standard (without user message) approaches
   * Uses adaptive strategy generation based on query complexity
   */
  async generateUnresolvedPeopleSearchParams(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    userMessage?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding, // Accept queryUnderstanding to avoid re-computation
    apiToken?: string,
    model: string = 'gpt-5.1-chat-latest',
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<
    | PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>
  > {

    
    if (queryUnderstanding && userMessage) {
      const queryUnderstandingText = this.searchStrategyService.formatQueryUnderstandingAsText(
        queryUnderstanding,
        userMessage,
      );

      const strategyTexts = await this.searchStrategyService.generateStrategies(
        openaiClient,
        queryUnderstandingText,
        userMessage,
        searchType,
        sendEvent,
        model,
        onTokenUsage,
      );

      this.logger.log(`Generated ${strategyTexts.length} search strategies as text: ${JSON.stringify(strategyTexts, null, 2)} for model ${model}`);
      const strategyResults: Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult> = [];

      for (let i = 0; i < strategyTexts.length; i++) {
        const strategy = strategyTexts[i];
        const eventResult = sendEvent?.('status', { 
          message: `Generating parameters for strategy ${i + 1}/${strategyTexts.length}: ${strategy.label || 'Strategy ' + (i + 1)}...` 
        });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping strategy parameter generation');
          break;
        }

        const parameterResult = await this.generateParamsFromStrategy(
          openaiClient,
          strategy.strategyText,
          queryUnderstandingText,
          userMessage,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
          model,
          onTokenUsage,
        );

        if (!parameterResult || !parameterResult.parameters) {
          this.logger.warn(`Strategy ${i + 1} did not produce usable parameters`);
          continue;
        }

        // Generate and use sophisticated boolean query for Sales Navigator and Recruiter
        if (searchType === 'sales_navigator' || searchType === 'recruiter') {
          await this.generateAndUseSophisticatedBooleanQuery(
            parameterResult.parameters,
            queryUnderstanding,
            searchType,
            apiToken,
            sendEvent,
          );
        }

        // Create strategy result from parameters and strategy text
        // First strategy (i === 0) is the primary strategy
        const strategyResult = this.searchStrategyService.buildStrategyResult(
          parameterResult.parameters,
          searchType,
          {
            id: i === 0 ? 'primary' : `strategy-${i + 1}`,
            label: strategy.label || (i === 0 ? 'Primary Search' : `Strategy ${i + 1}`),
            goal: `Search strategy: ${strategy.strategyText}`,
            description: strategy.strategyText,
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

        // For LinkedIn Classic, check if keywords exceed 6-term limit and split if needed
        if (searchType === 'classic') {
          const classicStrategy = strategyResult as ClassicPeopleSearchStrategyResult;
          const keywordTermCount = this.countKeywordTerms(classicStrategy.parameters.keywords);

          if (keywordTermCount > 6) {
            this.logger.log(
              `Strategy ${i + 1} has ${keywordTermCount} keyword terms (exceeds 6). Splitting into multiple strategies...`
            );

            const splitStrategies = await this.splitClassicKeywordsStrategy(
              openaiClient,
              classicStrategy,
              queryUnderstandingText,
              userMessage,
              sendEvent,
              model,
            );

            // REPLACE the original strategy with split strategies (not appending)
            // The original strategy is invalid (>6 terms), so we only add the split versions
            strategyResults.push(...splitStrategies);
          } else {
            // Keywords are within limit, add strategy as-is
            strategyResults.push(strategyResult);
          }
        } else {
          // For Sales Navigator and Recruiter, no keyword limit, add strategy as-is
          strategyResults.push(strategyResult);
        }
      }

      // Return all strategies in an array - first one is primary
      if (searchType === 'classic') {
        return {
          strategies: strategyResults as ClassicPeopleSearchStrategyResult[],
        } as PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>;
      } else if (searchType === 'sales_navigator') {
        return {
          strategies: strategyResults as SalesNavigatorPeopleSearchStrategyResult[],
        } as PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>;
      } else {
        return {
          strategies: strategyResults as RecruiterPeopleSearchStrategyResult[],
        } as PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>;
      }
    }

    // No user message - use standard prompt generation
    const basicParams = await this.streamPeopleSearchParameters(
      openaiClient,
      parsedJobDescription,
      rawJDText,
      searchType,
      sendEvent,
      includeJd,
      onTokenUsage,
      queryUnderstanding,
    );

    return this.wrapParametersAsResult(basicParams, searchType);
  }



  /**
   * Generic function to stream people search parameters with a single prompt
   */
  async streamPeopleSearchParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    rawJDText: string | undefined,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    onTokenUsage?: (usage: TokenUsage) => void,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {

    // Extract discovered industries from queryUnderstanding if available
    const discoveredIndustries = queryUnderstanding?.industry && queryUnderstanding.industry.length > 0
      ? queryUnderstanding.industry
      : undefined;

    let prompt = this.searchParametersPrompts.getPeopleSearchPrompt(
      searchType,
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
      false, // Generate user prompt
      discoveredIndustries,
    );


    const systemPrompt = prompt.system as string;
    const userPrompt = prompt.user as string;

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

    const streamResult = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
    const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

    // Accumulate token usage if available
    if (typeof streamResult !== 'string' && streamResult.usage && onTokenUsage) {
      onTokenUsage(streamResult.usage);
    }

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


  async generateParamsFromStrategy(
    openaiClient: OpenAI,
    strategyText: string,
    queryUnderstandingText: string,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    model: string = 'gpt-5.1-chat-latest',
    onTokenUsage?: (usage: TokenUsage) => void,
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
   * Generate and use sophisticated boolean query for Sales Navigator and Recruiter
   * This is generated on-demand during parameter generation, not stored in QueryUnderstanding
   */
  private async generateAndUseSophisticatedBooleanQuery(
    parameters: any,
    queryUnderstanding: QueryUnderstanding | undefined,
    searchType: 'sales_navigator' | 'recruiter',
    apiToken?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<void> {
    if (!queryUnderstanding || !apiToken || !parameters.keywords) {
      return;
    }

    try {
      // Discover job titles to get hierarchical and domain terms
      const discoveredJobTitles = await this.discoveryService.discoverJobTitles(
        queryUnderstanding.primaryRole,
        apiToken,
        sendEvent,
      );

      if (discoveredJobTitles.jobTitles.length > 0) {
        const booleanQueryResult = await this.booleanQueryBuilderService.generateSophisticatedBooleanQuery(
          queryUnderstanding.primaryRole,
          discoveredJobTitles,
          searchType,
          apiToken,
          sendEvent,
        );

        if (booleanQueryResult && booleanQueryResult.booleanQuery) {
          this.logger.log(`Using sophisticated boolean query: ${booleanQueryResult.booleanQuery}`);
          parameters.keywords = booleanQueryResult.booleanQuery;
          sendEvent?.('status', { message: 'Generated sophisticated boolean query for different company nomenclatures' });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to generate sophisticated boolean query: ${error}`);
      // Continue with original keywords - fall back to simple OR statements
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
   * Split a Classic strategy with keywords exceeding 6 terms into multiple keyword-limited strategies
   * This uses an LLM to intelligently split keywords while preserving search intent
   */
  async splitClassicKeywordsStrategy(
    openaiClient: OpenAI,
    originalStrategy: ClassicPeopleSearchStrategyResult,
    queryUnderstandingText: string,
    userMessage: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    model: string = 'gpt-5.1-chat-latest',
  ): Promise<ClassicPeopleSearchStrategyResult[]> {
    const originalKeywords = originalStrategy.parameters.keywords;
    if (!originalKeywords) {
      this.logger.warn('Cannot split strategy: no keywords found');
      return [originalStrategy];
    }

    const keywordTermCount = this.countKeywordTerms(originalKeywords);
    if (keywordTermCount <= 6) {
      // No splitting needed
      return [originalStrategy];
    }

    this.logger.log(
      `Splitting Classic strategy keywords: ${keywordTermCount} terms (exceeds 6-term limit). Original keywords: ${originalKeywords}`
    );

    sendEvent?.('status', { 
      message: `Splitting keywords into multiple strategies (${keywordTermCount} terms > 6 limit)...` 
    });

    const prompt = this.searchParametersPrompts.getClassicKeywordSplitSystemAndUserPrompts(
      originalKeywords,
      originalStrategy.parameters,
      originalStrategy.description,
      queryUnderstandingText,
      userMessage,
    );

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: prompt.user },
      ],
      zodResponseFormat(classicKeywordSplitSchema, 'classicKeywordSplit'),
    );

    const streamResult = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
    const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

    if (!fullContent) {
      this.logger.warn('Keyword splitting returned empty content, using original strategy');
      return [originalStrategy];
    }

    try {
      const parsed = JSON.parse(fullContent);
      const validated = classicKeywordSplitSchema.parse(parsed);

      this.logger.log(
        `Keyword splitting result: ${validated.splitStrategies.length} strategies. Reasoning: ${validated.reasoning}`
      );

      // Create multiple strategy results from the split keywords
      const splitStrategyResults: ClassicPeopleSearchStrategyResult[] = [];

      for (let i = 0; i < validated.splitStrategies.length; i++) {
        const splitStrategy = validated.splitStrategies[i];
        const splitKeywordTermCount = this.countKeywordTerms(splitStrategy.keywords);

        // Verify the split strategy has <= 6 terms
        if (splitKeywordTermCount > 6) {
          this.logger.warn(
            `Split strategy ${i + 1} still has ${splitKeywordTermCount} terms (exceeds 6). Skipping.`
          );
          continue;
        }

        // Create a new strategy result with the split keywords but same other parameters
        const splitParameters = {
          ...originalStrategy.parameters,
          keywords: splitStrategy.keywords,
        };

        // Remove redundant filters (same as original)
        this.removeRedundantFilters(splitParameters, 'classic');

        const splitStrategyResult: ClassicPeopleSearchStrategyResult = {
          ...originalStrategy,
          id: `${originalStrategy.id}-split-${i + 1}`,
          label: `${originalStrategy.label} - ${splitStrategy.label}`,
          description: `${originalStrategy.description}\n\nSplit Strategy: ${splitStrategy.description}`,
          goal: `${originalStrategy.goal} (Split ${i + 1}/${validated.splitStrategies.length}: ${splitStrategy.label})`,
          parameters: splitParameters,
          parameterRationales: {
            ...originalStrategy.parameterRationales,
            keywords: `Split from original strategy: ${splitStrategy.description}. ${validated.reasoning}`,
          },
        };

        splitStrategyResults.push(splitStrategyResult);
      }

      if (splitStrategyResults.length === 0) {
        this.logger.warn('No valid split strategies generated, using original strategy');
        return [originalStrategy];
      }

      this.logger.log(
        `Successfully split strategy into ${splitStrategyResults.length} keyword-limited strategies`
      );

      return splitStrategyResults;
    } catch (error) {
      this.logger.error(`Failed to parse keyword split result: ${error}`);
      return [originalStrategy];
    }
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
   * Creates a single strategy object from parameters (for cases without user message)
   */
  wrapParametersAsResult(
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): 
    | PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>
    | PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>
  {
    // Create a single primary strategy from the parameters
    const strategyResult = this.searchStrategyService.buildStrategyResult(
      parameters,
      searchType,
      {
        id: 'primary',
        label: 'Primary Search',
        goal: 'Targeted search based on job requirements',
        description: 'Search executed with the generated parameters',
        filterFocus: 'Generated parameters',
      },
    );

    if (searchType === 'classic') {
      return {
        strategies: [strategyResult as ClassicPeopleSearchStrategyResult],
      } as PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>;
    } else if (searchType === 'sales_navigator') {
      return {
        strategies: [strategyResult as SalesNavigatorPeopleSearchStrategyResult],
      } as PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>;
    } else {
      return {
        strategies: [strategyResult as RecruiterPeopleSearchStrategyResult],
      } as PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>;
    }
  }
}


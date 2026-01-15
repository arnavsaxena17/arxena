import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { SearchParameterGenerationService } from 'src/engine/core-modules/candidate-search/services/search-parameter-generation.service';
import { LinkedInClassicCompaniesSearchRequest, LinkedInClassicJobsSearchRequest, LinkedInSalesNavigatorCompaniesSearchRequest } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';
import { graphqlToFindManySearchFilters, SearchFilter, UpdateOneSearchFilter } from 'twenty-shared';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  QueryUnderstanding,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import { calculateCost } from '../utils/cost-calculation.util';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { constructSearchParamKey, generateLinkedInSearchUrl } from '../utils/search-parameter.utils';
import { TokenUsage } from '../utils/token-tracking.util';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { JobDescriptionService } from './job-description.service';
import { QueryUnderstandingService } from './query-understanding.service';
import { SearchExecutionService } from './search-execution.service';





type PeopleSearchGenerationResult<T> = {
  strategies: T[];
};

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionResult = {
  itemCount: number;
  searchResults: any;
  transformedCandidates?: any;
  searchMetadata?: any;
  validationResults?: Array<{
    page: number;
    validation: ResultValidationResult;
    timestamp: string;
  }>;
  overallValidation?: ResultValidationResult;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
};

@Injectable()
export class CandidateSearchHandlerService {
  private readonly logger = new Logger(CandidateSearchHandlerService.name);

  constructor(
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly jobDescriptionService: JobDescriptionService,
    private readonly searchParameterGenerationService: SearchParameterGenerationService,

  ) {}

  async handleSearchParametersAndResultsGenerationStream(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
    isClarificationResponse: boolean = false,
  ) {
    const { tokenAccumulator, accumulateTokens } = this.createTokenAccumulator();
    const model = 'gpt-5.1-chat-latest';
    
    try {
      sendEvent?.('status', { message: 'Analyzing query requirements...' });

      this.validateSearchParametersInput(parsedJD, searchType, searchCategory);
      const context = await this.prepareSearchContext(
        searchFilterId,
        searchType,
        searchCategory,
        apiToken,
        userMessage,
      );
      this.logger.log(`Generated context:: ${JSON.stringify(context, null, 2)}`);

      const queryUnderstanding = await this.extractQueryUnderstanding(
        userMessage,
        context.jobId,
        includeJd,
        isClarificationResponse,
        apiToken,
        searchType,
        sendEvent,
        accumulateTokens,
      );

      const clarificationResult = await this.handleClarificationIfNeeded(
        queryUnderstanding,
        isClarificationResponse,
        searchFilterId,
        apiToken,
        sendEvent,
      );
      if (clarificationResult) {
        return clarificationResult;
      }

      const searchResult = await this.generateAndExecuteSearchParameters(
        parsedJD,
        searchType,
        searchCategory,
        context,
        apiToken,
        userMessage,
        sendEvent,
        includeJd,
        queryUnderstanding,
        accumulateTokens,
      );

      return this.buildAndSendResponse(
        searchResult,
        tokenAccumulator,
        model,
        searchType,
        searchCategory,
        sendEvent,
      );
    } catch (error) {
      return this.handleSearchError(error, sendEvent);
    }
  }

  private createTokenAccumulator(): {
    tokenAccumulator: TokenUsage;
    accumulateTokens: (usage?: TokenUsage) => void;
  } {
    const tokenAccumulator: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
    };

    const accumulateTokens = (usage?: TokenUsage) => {
      if (usage) {
        tokenAccumulator.promptTokens += usage.promptTokens;
        tokenAccumulator.completionTokens += usage.completionTokens;
        tokenAccumulator.totalTokens += usage.totalTokens;
        tokenAccumulator.cachedTokens = (tokenAccumulator.cachedTokens || 0) + (usage.cachedTokens || 0);
      }
    };

    return { tokenAccumulator, accumulateTokens };
  }

  private async extractQueryUnderstanding(
    userMessage: string | undefined,
    jobId: string | undefined,
    includeJd: boolean,
    isClarificationResponse: boolean,
    apiToken: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
    accumulateTokens?: (usage: TokenUsage) => void,
  ): Promise<QueryUnderstanding | undefined> {
    if (!userMessage) {
      return undefined;
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);
      const rawJDText = includeJd && jobId 
        ? await this.jobDescriptionService.getJDContentFromJobAttachments(jobId, apiToken)
        : '';
      
      return await this.queryUnderstandingService.understandQuery(
        openaiClient,
        userMessage,
        rawJDText,
        sendEvent,
        isClarificationResponse,
        apiToken,
        searchType,
        accumulateTokens,
      );
    } catch (error) {
      this.logger.warn(`Failed to extract query understanding: ${error}`);
      return undefined;
    }
  }

  private async handleClarificationIfNeeded(
    queryUnderstanding: QueryUnderstanding | undefined,
    isClarificationResponse: boolean,
    searchFilterId: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<{
    success: boolean;
    type: string;
    data: any;
    chatMessage: string;
  } | null> {
    if (isClarificationResponse || !queryUnderstanding?.needsClarification) {
      return null;
    }

    const questions = queryUnderstanding.clarificationQuestions || [];
    const message = `I need some clarification to generate the best search parameters:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

    sendEvent?.('clarification', {
      questions,
      ambiguityReasons: queryUnderstanding.ambiguityReasons || [],
      message,
    });
    
    await this.storeClarificationContext(
      searchFilterId,
      questions,
      apiToken,
    );

    return {
      success: true,
      type: 'clarification',
      data: {
        questions,
        ambiguityReasons: queryUnderstanding.ambiguityReasons || [],
      },
      chatMessage: message,
    };
  }

  private async generateAndExecuteSearchParameters(
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    context: {
      accountId: string;
      searchParamKey: string;
      searchFilter: SearchFilter;
      jobId?: string;
    },
    apiToken: string,
    userMessage: string | undefined,
    sendEvent: ((event: string, data: any) => void) | undefined,
    includeJd: boolean,
    queryUnderstanding: QueryUnderstanding | undefined,
    accumulateTokens: (usage?: TokenUsage) => void,
  ): Promise<{
    unresolvedSearchParams: GeneratedSearchParameters;
    resolvedParams: GeneratedSearchParameters;
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>;
  }> {
    sendEvent?.('status', { message: 'Generating search parameters...' });

    const { unresolvedSearchParams, resolvedParams } =
      await this.generateResolvedSearchParameters(
        parsedJD,
        searchType,
        searchCategory,
        context.searchParamKey,
        context.accountId,
        context.jobId,
        apiToken,
        userMessage,
        sendEvent,
        includeJd,
        queryUnderstanding,
        accumulateTokens,
      );

    this.logger.log(`[Strategy] Generated unresolved search parameters:: ${JSON.stringify(unresolvedSearchParams, null, 2)}`); 
    this.logger.log(`[Strategy] Resolved parameters:: ${JSON.stringify(resolvedParams, null, 2)}`);
    
    const strategies = this.extractStrategiesFromGeneratedParams(
      unresolvedSearchParams,
      searchType,
      searchCategory,
    );

    this.logStrategies(strategies);

    const strategyResults = await this.executeStrategySearches(
      parsedJD,
      strategies,
      searchType,
      searchCategory,
      context.searchParamKey,
      apiToken,
      sendEvent,
      queryUnderstanding,
      userMessage,
    );

    await this.updateSearchFilterWithParameters(
      context.searchFilter,
      context.searchParamKey,
      unresolvedSearchParams,
      resolvedParams,
      apiToken,
      sendEvent,
    );

    return {
      unresolvedSearchParams,
      resolvedParams,
      strategyResults,
    };
  }

  private logStrategies(strategies: PeopleSearchStrategyResult[]): void {
    this.logger.log(`Strategies extracted: ${strategies.length} strategies found`);
    strategies.forEach((strategy) => {
      this.logger.log(`[Strategy: ${strategy.id}] Strategy details: ${JSON.stringify({ id: strategy.id, label: strategy.label, goal: strategy.goal }, null, 2)}`);
      this.logger.log(`[Strategy: ${strategy.id}] Strategy parameters: ${JSON.stringify(strategy.parameters, null, 2)}`);
    });
  }

  private buildAndSendResponse(
    searchResult: {
      unresolvedSearchParams: GeneratedSearchParameters;
      resolvedParams: GeneratedSearchParameters;
      strategyResults: Array<{
        strategy: PeopleSearchStrategyResult;
        result: SearchExecutionResult | null;
      }>;
    },
    tokenAccumulator: TokenUsage,
    model: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    sendEvent?: (event: string, data: any) => void,
  ): {
    success: boolean;
    type: string;
    data?: any;
    chatMessage: string;
    error?: string;
  } {
    const { unresolvedSearchParams, resolvedParams, strategyResults } = searchResult;
    const searchParamKey = this.getSearchParamKey(searchType, searchCategory);

    const resolvedSearchParametersResponse = this.buildSearchParametersResponse(
      unresolvedSearchParams,
      resolvedParams,
      searchParamKey,
      strategyResults,
      searchType,
      searchCategory,
    );

    this.logger.log(`Resolved search parameters response:: ${JSON.stringify(resolvedSearchParametersResponse, null, 2)}`);
    
    const totalTransformedCandidates = this.calculateTotalCandidates(strategyResults);
    const finalCost = this.calculateFinalCost(tokenAccumulator, model);
    const chatMessage = this.buildChatMessage(totalTransformedCandidates, searchType, searchCategory);

    sendEvent?.('message', {
      success: true,
      type: 'search_parameters',
      data: resolvedSearchParametersResponse,
      chatMessage,
    });

    this.sendFinalStatusEvents(
      totalTransformedCandidates,
      finalCost,
      tokenAccumulator,
      sendEvent,
    );

    return {
      success: true,
      type: 'search_parameters',
      data: resolvedSearchParametersResponse,
      chatMessage: `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
    };
  }

  private getSearchParamKey(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): string {
    return constructSearchParamKey(searchType, searchCategory);
  }

  private calculateTotalCandidates(
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>,
  ): number {
    return strategyResults.reduce((total, strategyResult) => {
      const candidates = strategyResult.result?.transformedCandidates || [];
      return total + candidates.length;
    }, 0);
  }

  private calculateFinalCost(
    tokenAccumulator: TokenUsage,
    model: string,
  ): ReturnType<typeof calculateCost> | null {
    return tokenAccumulator.totalTokens > 0
      ? calculateCost(
          model,
          tokenAccumulator.promptTokens,
          tokenAccumulator.completionTokens,
          tokenAccumulator.cachedTokens,
        )
      : null;
  }

  private buildChatMessage(
    totalTransformedCandidates: number,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): string {
    return totalTransformedCandidates > 0
      ? `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form. Found ${totalTransformedCandidates} candidate${totalTransformedCandidates !== 1 ? 's' : ''}.`
      : `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`;
  }

  private sendFinalStatusEvents(
    totalTransformedCandidates: number,
    finalCost: ReturnType<typeof calculateCost> | null,
    tokenAccumulator: TokenUsage,
    sendEvent?: (event: string, data: any) => void,
  ): void {
    if (totalTransformedCandidates > 0) {
      sendEvent?.('status', {
        message: `Found ${totalTransformedCandidates} candidate${totalTransformedCandidates !== 1 ? 's' : ''} total`,
      });
      
      if (finalCost && tokenAccumulator.totalTokens > 0) {
        sendEvent?.('tokenUsage', {
          promptTokens: tokenAccumulator.promptTokens,
          completionTokens: tokenAccumulator.completionTokens,
          totalTokens: tokenAccumulator.totalTokens,
          cachedTokens: tokenAccumulator.cachedTokens,
          cost: finalCost.totalCost,
          inputCost: finalCost.inputCost,
          outputCost: finalCost.outputCost,
          cachedCost: finalCost.cachedCost,
        });
      }
    }
  }

  private handleSearchError(
    error: any,
    sendEvent?: (event: string, data: any) => void,
  ): {
    success: boolean;
    error: string;
    chatMessage: string;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error('Error generating search parameters:', error);
    
    sendEvent?.('error', {
      error: `Failed to generate search parameters: ${errorMessage}`,
      chatMessage: `Sorry, I couldn't generate search parameters: ${errorMessage}`,
    });
    
    return {
      success: false,
      error: `Failed to generate search parameters: ${errorMessage}`,
      chatMessage: `Sorry, I couldn't generate search parameters: ${errorMessage}`,
    };
  }

  private validateSearchParametersInput(
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): void {
    if (!parsedJD) {
      throw new HttpException(
        'Parsed job description is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!searchType || !searchCategory) {
      throw new HttpException(
        'Search type and category are required',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async prepareSearchContext(
    searchFilterId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
  ): Promise<{
    accountId: string;
    searchParamKey: string;
    searchFilter: SearchFilter;
    jobId?: string;
  }> {
    const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(
      apiToken,
    );
    const searchParamKey = constructSearchParamKey(searchType, searchCategory);
    const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
    const jobId = searchFilter?.jobId;

    this.logger.log(`searchFilter:: ${JSON.stringify(searchFilter, null, 2)}`);
    this.logger.log(
      `Generating search parameters for ${searchType} ${searchCategory}`,
    );
    this.logger.log(`JobId: ${jobId}`);

    if (userMessage) {
      this.logger.log(`User message: ${userMessage}`);
    }

    return { accountId, searchParamKey, searchFilter, jobId };
  }

  private async generateResolvedSearchParameters(
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchParamKey: string,
    accountId: string,
    jobId?: string,
    apiToken?: string,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<{
    unresolvedSearchParams: GeneratedSearchParameters;
    resolvedParams: GeneratedSearchParameters;
  }> {
    const strategyId = 'primary';
    this.logger.log(`[Strategy: ${strategyId}] Generating and resolving search parameters for ${searchParamKey}`);
    
    sendEvent?.('status', { message: 'Connecting to AI model...' });
    const unresolvedSearchParams =
      await this.generateUnresolvedSearchParams(
        parsedJD,
        searchType,
        searchCategory,
        apiToken!,
        userMessage,  
        jobId,
        sendEvent,
        includeJd,
        queryUnderstanding,
        undefined, // model - use default
        onTokenUsage, // Pass token accumulator
      );

    if (!unresolvedSearchParams) {
      throw new HttpException(
        'Failed to generate search parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`[Strategy: ${strategyId}] searchParamKey:: ${searchParamKey}`);
    // Extract search parameters
    const searchParams = unresolvedSearchParams[searchParamKey];
    
    let resolvedParams = {};

    if (!searchParams) {
      this.logger.warn(
        `[Strategy: ${strategyId}] No search parameters generated for ${searchParamKey}, using empty object`,
      );
    } else {
      sendEvent?.('status', { message: 'Resolving parameter IDs...' });
      this.logger.log(`[Strategy: ${strategyId}] Resolving parameter IDs for search parameters`);
      const resolvedSearchParameters = await this.linkedinParameterResolver.resolveParameterIds(
        searchParams,
        accountId,
        strategyId,
      );
      // Store resolved params under the searchParamKey for consistency
      resolvedParams = {
        [searchParamKey]: resolvedSearchParameters[searchParamKey] || resolvedSearchParameters,
      };
      this.logger.log(`[Strategy: ${strategyId}] Completed resolving search parameters`);
    }
    return { unresolvedSearchParams, resolvedParams };
  }

  private async updateSearchFilterWithParameters(
    searchFilter: SearchFilter,
    searchParamKey: string,
    searchParams: GeneratedSearchParameters,
    resolvedParams: GeneratedSearchParameters,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<void> {
    const updatedSearchFilterParameter = {
      ...searchFilter.searchFilterParameter,
      generatedSearchParameters: {
        ...searchFilter.searchFilterParameter?.generatedSearchParameters,
        [searchParamKey]: searchParams[searchParamKey],
      },
      resolvedSearchParameters: {
        ...searchFilter.searchFilterParameter?.resolvedSearchParameters,
        [searchParamKey]: resolvedParams,
      },
    };

    sendEvent?.('status', { message: 'Saving parameters...' });
    await this.updateSearchFilterParameters(
      searchFilter.id,
      updatedSearchFilterParameter,
      searchFilter.chatHistory,
      apiToken,
    );
  }

  private extractStrategiesFromGeneratedParams(
    searchParams: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): PeopleSearchStrategyResult[] {
    if (searchType === 'classic' && searchCategory === 'people') {
      return searchParams.classicPeopleSearchStrategies || [];
    }
    if (searchType === 'sales_navigator' && searchCategory === 'people') {
      return (
        searchParams.salesNavigatorPeopleSearchStrategies || []
      );
    }
    if (searchType === 'recruiter' && searchCategory === 'people') {
      return searchParams.recruiterPeopleSearchStrategies || [];
    }
    return [];
  }

  private async executeStrategySearches(
    parsedJobDescription: ParsedJobDescription,
    strategies: PeopleSearchStrategyResult[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
  ): Promise<
    Array<{ strategy: PeopleSearchStrategyResult; result: SearchExecutionResult | null }>
  > {
    this.logger.log(
      `Found ${strategies.length} strategies to execute searches for ${searchType} ${searchCategory}`,
    );

    if (strategies.length === 0) {
      this.logger.log(
        `No strategies found for ${searchType} ${searchCategory}`,
      );
      return [];
    }

    this.logger.log(`Executing searches for ${strategies.length} strategies...`);
    sendEvent?.('status', {
      message: `Executing searches for ${strategies.length} strategies...`,
    });

    const results: Array<{
      strategyId: string;
      result: SearchExecutionResult | null;
    }> = [];



    for (const strategy of strategies) {
      const result = await this.executeStrategySearch(
        parsedJobDescription,
        strategy,
        searchType,
        searchCategory,
        parameterKey,
        apiToken,
        queryUnderstanding,
        userMessage,
        sendEvent,
      );
      results.push({ strategyId: strategy.id, result });
    }


    const strategyResults = strategies.map((strategy) => {
      const result =
        results.find((sp) => sp.strategyId === strategy.id)?.result ||
        null;
      return { strategy, result };
    });

    const successfulResults = strategyResults.filter((sr) => sr.result && !sr.result.error).length;
    const failedResults = strategyResults.filter((sr) => sr.result?.error).length;
    const noResults = strategyResults.filter((sr) => !sr.result).length;
    
    this.logger.log(
      `Completed searches for ${strategies.length} strategies: ${successfulResults} successful, ${failedResults} failed, ${noResults} no results`,
    );
    sendEvent?.('status', {
      message: `Completed searches for ${strategies.length} strategies${failedResults > 0 ? ` (${failedResults} failed)` : ''}`,
    });

    return strategyResults;
  }

  /**
   * Builds the response object for search parameters generation
   * - Adds LinkedIn URLs to strategies
   * - Structures the response with generated and resolved parameters
   */
  private buildSearchParametersResponse(
    searchParams: GeneratedSearchParameters,
    resolvedParams: GeneratedSearchParameters,
    searchParamKey: string,
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): {
    generatedSearchParameters: GeneratedSearchParameters;
    resolvedSearchParameters: GeneratedSearchParameters;
    strategyResults?: Array<{
      strategy: PeopleSearchStrategyResult & { linkedInUrl?: string | null };
      result: SearchExecutionResult | null;
    }>;
    linkedInUrl: string | null;
  } {
    // Generate LinkedIn URL for primary search parameters
    const primarySearchParameters = resolvedParams[searchParamKey];
    const primaryLinkedInUrl = primarySearchParameters
      ? generateLinkedInSearchUrl(
          primarySearchParameters,
          searchType,
          searchCategory,
        )
      : null;

    // Generate LinkedIn URLs for each strategy
    // Only generate URLs if parameters are resolved (contain numeric IDs, not names)
    const strategyResultsWithUrls = strategyResults.map((strategyResult) => {
      const strategyParams = strategyResult.strategy?.parameters;
      
      const areParamsResolved = this.areStrategyParametersResolved(strategyParams);
      const strategyLinkedInUrl = strategyParams && areParamsResolved
        ? generateLinkedInSearchUrl(strategyParams, searchType, searchCategory)
        : null;

      return {
        ...strategyResult,
        strategy: {
          ...strategyResult.strategy,
          linkedInUrl: strategyLinkedInUrl,
        },
      };
    });

    return {
      generatedSearchParameters: searchParams,
      resolvedSearchParameters: resolvedParams,
      strategyResults: strategyResultsWithUrls.length > 0 ? strategyResultsWithUrls : undefined,
      linkedInUrl: primaryLinkedInUrl,
    };
  }

  /**
   * Check if strategy parameters are resolved (contain numeric IDs, not names)
   */
  private areStrategyParametersResolved(params: any): boolean {
    if (!params) return false;
    
    // Check if location/company arrays contain unresolved string names (not numeric IDs)
    const hasUnresolvedStrings = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => 
        typeof item === 'string' && 
        !item.match(/^\d+$/) && 
        !item.includes('urn:li:')
      );
    };
    
    // Check for unresolved location names
    if (params.location) {
      if (Array.isArray(params.location) && hasUnresolvedStrings(params.location)) {
        return false;
      }
      if (params.location.include && Array.isArray(params.location.include) && hasUnresolvedStrings(params.location.include)) {
        return false;
      }
    }
    
    // Check for unresolved company names
    if (params.company) {
      if (Array.isArray(params.company) && hasUnresolvedStrings(params.company)) {
        return false;
      }
      if (params.company.include && Array.isArray(params.company.include) && hasUnresolvedStrings(params.company.include)) {
        return false;
      }
    }
    
    // If no location/company params or all are resolved, parameters are ready for URL generation
    return true;
  }

  private async executeStrategySearch(
    parsedJobDescription: ParsedJobDescription,
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<SearchExecutionResult | null> {

    const previewLimit = Number(process.env.AUTO_SEARCH_PREVIEW_LIMIT ?? 25);

    const strategyId = strategy.id;
    try {
      if (!strategy.parameters) {
        this.logger.warn(
          `[Strategy: ${strategyId}] Strategy has no parameters, skipping search preview`,
        );
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      this.logger.log(
        `[Strategy: ${strategyId}] Executing search preview for strategy (${strategy.label || 'unnamed'})`,
      );
      this.logger.log(
        `[Strategy: ${strategyId}] Parameters before resolution: ${JSON.stringify(strategy.parameters, null, 2)}`,
      );
      
      // Check if parameters need resolution and resolve if needed
      const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(apiToken);
      const needsResolution = !this.areStrategyParametersResolved(strategy.parameters);
      if (needsResolution) {
        this.logger.log(`[Strategy: ${strategyId}] Resolving parameter IDs for strategy parameters`);
        const resolvedParams = await this.linkedinParameterResolver.resolveParameterIds(
          strategy.parameters,
          accountId,
          strategyId,
        );
        strategyResolvedParams[parameterKey] = resolvedParams;
        // Update strategy object with resolved parameters to avoid duplicate resolution
        strategy.parameters = resolvedParams;
        this.logger.log(`[Strategy: ${strategyId}] Completed resolving strategy parameters`);
      } else {
        this.logger.log(`[Strategy: ${strategyId}] Parameters already resolved, skipping resolution`);
      }

      // Use multi-page search if query understanding is available
        const searchResult: SearchExecutionResult | null = await this.searchExecutionService.executeMultiPageStrategySearch(
          parsedJobDescription,
          strategy,
          searchType,
          searchCategory,
          parameterKey,
          apiToken,
          queryUnderstanding,
          userMessage,
          sendEvent,
        );

        return searchResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
      
      this.logger.error(
        `[Strategy: ${strategyId}] Failed to execute search preview for strategy (${strategy.label || 'unnamed'}):`,
        error,
      );
      
      // Extract error details from LinkedIn API errors
      let errorDetails: string | undefined;
      if (errorMessage.includes('Content too large')) {
        errorDetails = 'The search parameters are too complex. Try simplifying the search criteria.';
      } else if (errorMessage.includes('LinkedIn search failed')) {
        errorDetails = errorMessage.replace('LinkedIn search failed: ', '');
      }
      
      // Return error information instead of null
      return {
        itemCount: 0,
        searchResults: null,
        transformedCandidates: undefined,
        searchMetadata: undefined,
        error: {
          message: errorMessage,
          code: errorCode,
          details: errorDetails || errorMessage,
        },
      };
    }
  }
  async getSearchFilter(searchFilterId: string, apiToken: string) {
    const query = graphqlToFindManySearchFilters;

    const graphQLResponse = await this.staticGraphQLService.executeGraphQL(
      query,
      { filter: { id: { eq: searchFilterId } } },
      apiToken,
    );

    if (!graphQLResponse.data?.data?.searchFilters?.edges?.[0]?.node) {
      throw new HttpException('Search filter not found', HttpStatus.NOT_FOUND);
    }
    return graphQLResponse.data.data.searchFilters.edges[0].node;
  }
  async addChatMessage(
    searchFilterId: string,
    role: 'user' | 'assistant',
    content: string,
    apiToken: string,
  ) {
    const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
    const currentHistory = searchFilter.chatHistory || [];
    const newMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...currentHistory, newMessage];
    const updateMutation = UpdateOneSearchFilter;
    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      { idToUpdate: searchFilterId, input: { chatHistory: updatedHistory } },
      apiToken,
    );
  }
  private async updateSearchFilterParameters(
    searchFilterId: string,
    updatedSearchFilterParameter: any,
    chatHistory: any,
    apiToken: string,
  ): Promise<void> {
    const updateMutation = UpdateOneSearchFilter;
    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      {
        idToUpdate: searchFilterId,
        input: {
          searchFilterParameter: updatedSearchFilterParameter,
          chatHistory: chatHistory,
        },
      },
      apiToken,
    );
  }

  private async storeClarificationContext(
    searchFilterId: string,
    questions: string[],
    apiToken: string,
  ): Promise<void> {
    try {
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const searchFilterParameter = searchFilter.searchFilterParameter || {};
      
      // Store clarification in searchFilterParameter metadata
      const updatedParameter = {
        ...searchFilterParameter,
        pendingClarification: {
          questions,
          timestamp: new Date().toISOString(),
        },
      };

      await this.updateSearchFilterParameters(
        searchFilterId,
        updatedParameter,
        searchFilter.chatHistory,
        apiToken,
      );
    } catch (error) {
      this.logger.error(`Failed to store clarification context: ${error}`);
    }
  }


  async generateUnresolvedSearchParams(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    jobId?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
    model: string = 'gpt-5.1-chat-latest',
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<GeneratedSearchParameters> {
    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const generatedParameters: GeneratedSearchParameters = {};      
      this.logger.log(`Generating search parameters for ${searchType} ${searchCategory}`);
      if (userMessage)
        this.logger.log(`User message: ${userMessage}`);

      const rawJDText = includeJd && jobId
        ? await this.jobDescriptionService.getJDContentFromJobAttachments(jobId, apiToken)
        : '';
      
      if (rawJDText && includeJd) {
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);
      } else if (!includeJd) {
        this.logger.log(`JD content excluded from prompts (includeJd=false)`);
      }

      const isStreamAborted = sendEvent?.('status', { message: `Generating ${searchType} ${searchCategory} search parameters...` });
      if (isStreamAborted === false) {
        this.logger.log('Stream aborted, stopping parameter generation');
        return generatedParameters;
      }

      // Handle people search (same logic for all search types)
      if (searchCategory === 'people') {
        const peopleSearchParams = await this.searchParameterGenerationService.generateUnresolvedPeopleSearchParams(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          rawJDText,
          sendEvent,
          includeJd,
          queryUnderstanding,
          apiToken,
          model,
          onTokenUsage, // Pass token accumulator
        );

        if (searchType === 'classic') {
          const result = peopleSearchParams as PeopleSearchGenerationResult<ClassicPeopleSearchStrategyResult>;
          const strategies = result.strategies || [];
          // Extract primary from first strategy
          if (strategies.length > 0) {
            generatedParameters.classicPeopleSearch = strategies[0].parameters;
            // Store all strategies (including primary) in strategies array
            generatedParameters.classicPeopleSearchStrategies = strategies;
          }
        } else if (searchType === 'sales_navigator') {
          const result = peopleSearchParams as PeopleSearchGenerationResult<SalesNavigatorPeopleSearchStrategyResult>;
          const strategies = result.strategies || [];
          if (strategies.length > 0) {
            generatedParameters.salesNavigatorPeopleSearch = strategies[0].parameters;
            generatedParameters.salesNavigatorPeopleSearchStrategies = strategies;
          }
        } else if (searchType === 'recruiter') {
          const result = peopleSearchParams as PeopleSearchGenerationResult<RecruiterPeopleSearchStrategyResult>;
          const strategies = result.strategies || [];
          if (strategies.length > 0) {
            generatedParameters.recruiterPeopleSearch = strategies[0].parameters;
            generatedParameters.recruiterPeopleSearchStrategies = strategies;
          }
        }
        return generatedParameters;
      }

      if (searchCategory === 'companies' && (searchType === 'classic' || searchType === 'sales_navigator')) {
        const companiesSearchParams = await this.searchParameterGenerationService.streamCompaniesSearchParameters(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          rawJDText,
          sendEvent,
          includeJd,
          onTokenUsage,
        );

        if (searchType === 'classic') {
          generatedParameters.classicCompaniesSearch = companiesSearchParams as Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>;
        } else {
          generatedParameters.salesNavigatorCompaniesSearch = companiesSearchParams as Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>;
        }
        return generatedParameters;
      }

      // Handle jobs search (only classic)
      if (searchCategory === 'jobs' && searchType === 'classic') {
        const jobsSearchParams = await this.searchParameterGenerationService.streamJobsSearchParameters(
          parsedJobDescription,
          openaiClient,
          userMessage,
          rawJDText,
          sendEvent,
          includeJd,
        );
        generatedParameters.classicJobsSearch = jobsSearchParams as Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>;
      }

      return generatedParameters;
    } catch (error) {
        this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
        throw error;
    }
    }
}


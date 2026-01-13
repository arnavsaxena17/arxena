import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { SearchParameterGenerationService } from 'src/engine/core-modules/candidate-search/services/search-parameter-generation.service';
import { LinkedInClassicCompaniesSearchRequest, LinkedInClassicJobsSearchRequest, LinkedInClassicPeopleSearchRequest, LinkedInRecruiterPeopleSearchRequest, LinkedInSalesNavigatorCompaniesSearchRequest, LinkedInSalesNavigatorPeopleSearchRequest } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';
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
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { constructSearchParamKey, generateLinkedInSearchUrl } from '../utils/search-parameter.utils';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { JobDescriptionService } from './job-description.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { QueryUnderstandingService } from './query-understanding.service';
import { SearchExecutionService } from './search-execution.service';
import { StrategyEvolutionService } from './strategy-evolution.service';





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

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionPreview = {
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
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly strategyEvolution: StrategyEvolutionService,
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

      // Extract query understanding if user message is available - CHECK BEFORE GENERATING PARAMETERS
      let queryUnderstanding: QueryUnderstanding | undefined;
      if (userMessage) {
        try {
          const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
          const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);
          const rawJDText = includeJd && context.jobId 
            ? await this.jobDescriptionService.getJDContentFromJobAttachments(context.jobId, apiToken)
            : '';
          
          queryUnderstanding = await this.queryUnderstandingService.understandQuery(
            openaiClient,
            userMessage,
            rawJDText,
            sendEvent,
            isClarificationResponse,
            apiToken,
          );
        } catch (error) {
          this.logger.warn(`Failed to extract query understanding: ${error}`);
        }
      }

      // Check if clarification is needed - RETURN EARLY if so (unless this is a clarification response)
      if (!isClarificationResponse && queryUnderstanding?.needsClarification) {
        sendEvent?.('clarification', {
          questions: queryUnderstanding.clarificationQuestions || [],
          ambiguityReasons: queryUnderstanding.ambiguityReasons || [],
          message: `I need some clarification to generate the best search parameters:\n\n${(queryUnderstanding.clarificationQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        });
        
        // Store clarification context
        await this.storeClarificationContext(
          searchFilterId,
          queryUnderstanding.clarificationQuestions || [],
          apiToken,
        );

        return {
          success: true,
          type: 'clarification',
          data: {
            questions: queryUnderstanding.clarificationQuestions || [],
            ambiguityReasons: queryUnderstanding.ambiguityReasons || [],
          },
          chatMessage: `I need some clarification to generate the best search parameters:\n\n${(queryUnderstanding.clarificationQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        };
      }

      // Only proceed with parameter generation if no clarification is needed
      sendEvent?.('status', { message: 'Generating search parameters...' });

          const { unresolvedSearchParams, resolvedParams } =
        await this.generateAndResolvedSearchParameters(
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
        );

      this.logger.log(`[Strategy: primary] Generated and unresolved search parameters:: ${JSON.stringify(unresolvedSearchParams, null, 2)}`); 
      this.logger.log(`[Strategy: primary] Resolved parameters:: ${JSON.stringify(resolvedParams, null, 2)}`);
      
      const strategies = this.extractStrategiesFromGeneratedParams(
        unresolvedSearchParams,
        searchType,
        searchCategory,
      );

      this.logger.log(`Strategies extracted: ${strategies.length} strategies found`);
      strategies.forEach((strategy) => {
        this.logger.log(`[Strategy: ${strategy.id}] Strategy details: ${JSON.stringify({ id: strategy.id, label: strategy.label, goal: strategy.goal }, null, 2)}`);
        this.logger.log(`[Strategy: ${strategy.id}] Strategy parameters: ${JSON.stringify(strategy.parameters, null, 2)}`);
      });



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


      // If no strategies but primary parameters exist, execute search for primary
      // Check both direct key and primary structure
      const primaryParams = unresolvedSearchParams[context.searchParamKey] || 
                           (unresolvedSearchParams as any).primary;
      const hasPrimaryParams = !!primaryParams;
      
      if (strategyResults.length === 0 && hasPrimaryParams) {
        const strategyId = 'primary';
        this.logger.log(`[Strategy: ${strategyId}] No strategies found, executing search for primary parameters`);
        sendEvent?.('status', { message: 'Executing search with generated parameters...' });

        try {
          
          // Use already resolved parameters if available
          let resolvedPrimaryParams: GeneratedSearchParameters;
          if (resolvedParams[context.searchParamKey]) {
            resolvedPrimaryParams = {
              [context.searchParamKey]: resolvedParams[context.searchParamKey],
            } as GeneratedSearchParameters;
          } else if (Object.keys(resolvedParams).length > 0) {
            // If resolvedParams has data but not under the key, use it directly
            resolvedPrimaryParams = resolvedParams as GeneratedSearchParameters;
          } else {
            // Resolve now if not already resolved
            const strategyId = 'primary';
            sendEvent?.('status', { message: 'Resolving parameter IDs...' });
            this.logger.log(`[Strategy: ${strategyId}] Resolving parameter IDs for primary search parameters`);
            const resolvedSearchParameters = await this.linkedinParameterResolver.resolveParameterIds(
              primaryParams,
              context.accountId,
              strategyId,
            );
            resolvedPrimaryParams = {
              [context.searchParamKey]: resolvedSearchParameters[context.searchParamKey] || resolvedSearchParameters,
            } as GeneratedSearchParameters;
            this.logger.log(`[Strategy: ${strategyId}] Completed resolving primary search parameters`);
          }

          // Get resolved parameters for the strategy (use resolved version if available)
          const strategyParameters = resolvedPrimaryParams[context.searchParamKey] || primaryParams;

          this.logger.log(`[Strategy: ${strategyId}] Primary strategy parameters: ${JSON.stringify(strategyParameters, null, 2)}`);

          // Create a primary strategy object for multi-page search
          const primaryStrategy: PeopleSearchStrategyResult = {
            id: 'primary',
            label: 'Primary Search',
            goal: 'Targeted search based on your requirements',
            aggressiveness: 'focused' as const,
            description: 'Search executed with the generated parameters',
            whenToUse: 'Primary search strategy',
            estimatedCandidateCount: { minimum: 40, maximum: 80 },
            filterFocus: 'Generated parameters',
            parameterRationales: {},
            parameters: strategyParameters,
          } as PeopleSearchStrategyResult;

          // Use multi-page search if query understanding is available (same logic as strategies)
          let searchPreview: SearchExecutionPreview | null;
          if (queryUnderstanding && userMessage) {
            searchPreview = await this.searchExecutionService.executeMultiPageStrategySearch(
              parsedJD,
              primaryStrategy,
              searchType,
              searchCategory,
              context.searchParamKey,
              apiToken,
              queryUnderstanding,
              userMessage,
              sendEvent,
            );
          } else {
            // Fallback to single page search
            const searchResponse = await this.candidateSearchBaseService.searchCandidatesWithParameters(
              parsedJD,
              resolvedPrimaryParams,
              searchType,
              searchCategory,
              apiToken,
              { limit: 25 },
              queryUnderstanding,
              userMessage,
              sendEvent,
            );
            searchPreview = {
              itemCount: searchResponse.transformedCandidates?.length || 0,
              searchResults: searchResponse.searchResults,
              transformedCandidates: searchResponse.transformedCandidates,
              searchMetadata: searchResponse.searchMetadata,
            };
          }

          // Add primary search result as a strategy result for consistency
          strategyResults.push({
            strategy: primaryStrategy,
            preview: searchPreview,
          });

          this.logger.log(`[Strategy: ${strategyId}] Primary search completed: ${searchPreview?.itemCount || 0} candidates found`);
        } catch (error) {
          const strategyId = 'primary';
          this.logger.error(`[Strategy: ${strategyId}] Failed to execute primary search: ${error}`);
          strategyResults.push({
            strategy: {
              id: strategyId,
              label: 'Primary Search',
              goal: 'Targeted search based on your requirements',
              aggressiveness: 'focused' as const,
              description: 'Search executed with the generated parameters',
              whenToUse: 'Primary search strategy',
              estimatedCandidateCount: { minimum: 0, maximum: 0 },
              filterFocus: 'Generated parameters',
              parameterRationales: {},
              parameters: primaryParams,
            } as PeopleSearchStrategyResult,
            preview: {
              itemCount: 0,
              searchResults: null,
              error: {
                message: error instanceof Error ? error.message : 'Failed to execute search',
                details: 'The search could not be completed. Please try again or adjust your parameters.',
              },
            },
          });
        }
      }

      await this.updateSearchFilterWithParameters(
        context.searchFilter,
        context.searchParamKey,
        unresolvedSearchParams,
        resolvedParams,
        apiToken,
        sendEvent,
      );

      const resolvedSearchParametersResponse = this.buildSearchParametersResponse(
        unresolvedSearchParams,
        resolvedParams,
        context.searchParamKey,
        strategyResults,
        searchType,
        searchCategory,
      );

      this.logger.log(`Resolved search parameters response:: ${JSON.stringify(resolvedSearchParametersResponse, null, 2)}`);
      // Calculate total transformed candidates count from all strategy results
      const totalTransformedCandidates = strategyResults.reduce((total, strategyResult) => {
        const candidates = strategyResult.preview?.transformedCandidates || [];
        return total + candidates.length;
      }, 0);

      const chatMessage = totalTransformedCandidates > 0
        ? `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form. Found ${totalTransformedCandidates} candidate${totalTransformedCandidates !== 1 ? 's' : ''}.`
        : `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`;

      sendEvent?.('message', {
        success: true,
        type: 'search_parameters',
        data: resolvedSearchParametersResponse,
        chatMessage,
      });

      // Send status event with final candidate count
      if (totalTransformedCandidates > 0) {
        sendEvent?.('status', {
          message: `Found ${totalTransformedCandidates} candidate${totalTransformedCandidates !== 1 ? 's' : ''} total`,
        });
      }

      return {
        success: true,
        type: 'search_parameters',
        data: resolvedSearchParametersResponse,
        chatMessage: `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
      };
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      sendEvent?.('error', {
        error: `Failed to generate search parameters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate search parameters: ${error.message}`,
      });
      return {
        success: false,
        error: `Failed to generate search parameters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate search parameters: ${error.message}`,
      };
    }
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

  private async generateAndResolvedSearchParameters(
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
      );

    if (!unresolvedSearchParams) {
      throw new HttpException(
        'Failed to generate search parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`[Strategy: ${strategyId}] searchParamKey:: ${searchParamKey}`);
    // Handle both structures: { primary: {...} } and { classicPeopleSearch: {...} }
    let primarySearchParams = unresolvedSearchParams[searchParamKey];
    if (!primarySearchParams && (unresolvedSearchParams as any).primary) {
      // If we have primary structure, use that
      primarySearchParams = (unresolvedSearchParams as any).primary;
    }
    
    let resolvedParams = {};

    if (!primarySearchParams) {
      this.logger.warn(
        `[Strategy: ${strategyId}] No search parameters generated for ${searchParamKey}, using empty object`,
      );
    } else {
      sendEvent?.('status', { message: 'Resolving parameter IDs...' });
      this.logger.log(`[Strategy: ${strategyId}] Resolving parameter IDs for primary search parameters`);
      const resolvedSearchParameters = await this.linkedinParameterResolver.resolveParameterIds(
        primarySearchParams,
        accountId,
        strategyId,
      );
      // Store resolved params under the searchParamKey for consistency
      resolvedParams = {
        [searchParamKey]: resolvedSearchParameters[searchParamKey] || resolvedSearchParameters,
      };
      this.logger.log(`[Strategy: ${strategyId}] Completed resolving primary search parameters`);
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
    Array<{ strategy: PeopleSearchStrategyResult; preview: SearchExecutionPreview | null }>
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

    const strategyPreviews = await this.executeSearchResultsForStrategies(
      parsedJobDescription,
      strategies,
      searchType,
      searchCategory,
      apiToken,
      parameterKey,
      queryUnderstanding,
      userMessage,
      sendEvent,
    );

    const strategyResults = strategies.map((strategy) => {
      const preview =
        strategyPreviews.find((sp) => sp.strategyId === strategy.id)?.preview ||
        null;
      return { strategy, preview };
    });

    const successfulResults = strategyResults.filter((sr) => sr.preview && !sr.preview.error).length;
    const failedResults = strategyResults.filter((sr) => sr.preview?.error).length;
    const noResults = strategyResults.filter((sr) => !sr.preview).length;
    
    this.logger.log(
      `Completed searches for ${strategies.length} strategies: ${successfulResults} successful, ${failedResults} failed, ${noResults} no results`,
    );
    sendEvent?.('status', {
      message: `Completed searches for ${strategies.length} strategies${failedResults > 0 ? ` (${failedResults} failed)` : ''}`,
    });

    // Store search performance in knowledge base
    if (queryUnderstanding) {
      this.knowledgeBase.storeSearchPerformance(queryUnderstanding, strategyResults);
    }

    // Check if results are poor and trigger strategy evolution
    const poorResults = strategyResults.filter(
      (sr) =>
        !sr.preview ||
        sr.preview.error ||
        (sr.preview.overallValidation &&
          (sr.preview.overallValidation.qualityAssessment === 'low' ||
            sr.preview.overallValidation.relevanceScore < 0.5)) ||
        (sr.preview.itemCount === 0),
    );

    if (poorResults.length > 0 && queryUnderstanding && poorResults.length === strategyResults.length) {
      // All strategies failed - try strategy evolution
      this.logger.log('All strategies failed, attempting strategy evolution...');
      sendEvent?.('status', {
        message: 'Analyzing strategy failures and generating alternative approaches...',
      });

      try {
        const failureAnalysis = await this.strategyEvolution.analyzeStrategyFailures(
          queryUnderstanding,
          strategyResults,
          apiToken,
        );

        const alternativeStrategies = await this.strategyEvolution.generateAlternativeStrategies(
          queryUnderstanding,
          failureAnalysis,
          strategies,
          apiToken,
        );

        if (alternativeStrategies.length > 0) {
          this.logger.log(
            `Generated ${alternativeStrategies.length} alternative strategies, but not retrying automatically. Evolution insights stored for future searches.`,
          );
          sendEvent?.('status', {
            message: `Generated ${alternativeStrategies.length} alternative strategies based on failure analysis`,
          });
        }
      } catch (error) {
        this.logger.error(`Strategy evolution failed: ${error}`);
      }
    }

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
      preview: SearchExecutionPreview | null;
    }>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): {
    generatedSearchParameters: GeneratedSearchParameters;
    resolvedSearchParameters: GeneratedSearchParameters;
    strategyResults?: Array<{
      strategy: PeopleSearchStrategyResult & { linkedInUrl?: string | null };
      preview: SearchExecutionPreview | null;
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

  private async executeSearchResultsForStrategies(
    parsedJobDescription: ParsedJobDescription,
    strategies: PeopleSearchStrategyResult[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    parameterKey: string,
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Array<{ strategyId: string; preview: SearchExecutionPreview | null }>> {
    const previewLimit = Number(process.env.AUTO_SEARCH_PREVIEW_LIMIT ?? 25);
    const results: Array<{
      strategyId: string;
      preview: SearchExecutionPreview | null;
    }> = [];

    for (const strategy of strategies) {
      const preview = await this.executeStrategySearch(
        parsedJobDescription,
        strategy,
        searchType,
        searchCategory,
        parameterKey,
        apiToken,
        previewLimit,
        queryUnderstanding,
        userMessage,
        sendEvent,
      );
      results.push({ strategyId: strategy.id, preview });
    }

    return results;
  }

  private async executeStrategySearch(
    parsedJobDescription: ParsedJobDescription,
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    previewLimit: number,
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<SearchExecutionPreview | null> {
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
        this.logger.log(`[Strategy: ${strategyId}] Completed resolving strategy parameters`);
      } else {
        this.logger.log(`[Strategy: ${strategyId}] Parameters already resolved, skipping resolution`);
      }

      // Use multi-page search if query understanding is available
      if (queryUnderstanding && userMessage) {
        return await this.searchExecutionService.executeMultiPageStrategySearch(
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
      }

      // Fallback to single page search
      const searchResponse =
        await this.candidateSearchBaseService.searchCandidatesWithParameters(
          parsedJobDescription,
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          { limit: previewLimit },
          queryUnderstanding,
          userMessage,
          sendEvent,
        );

      this.logger.log(
        `[Strategy: ${strategyId}] Preview completed: ${searchResponse.searchResults?.items?.length ?? 0} candidates found`,
      );

      return {
        itemCount: searchResponse.searchResults?.items?.length ?? 0,
        searchResults: searchResponse.searchResults,
        transformedCandidates: searchResponse.transformedCandidates,
        searchMetadata: searchResponse.searchMetadata,
      };
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
      {
        idToUpdate: searchFilterId,
        input: {
          chatHistory: updatedHistory,
        },
      },
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
        const peopleSearchParams = await this.searchParameterGenerationService.generatePeopleSearchParams(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          rawJDText,
          sendEvent,
          includeJd,
          queryUnderstanding,
          apiToken,
        );

        if (searchType === 'classic') {
          const classicPeopleSearchParams = peopleSearchParams as ClassicPeopleSearchGenerationResult;
          generatedParameters.classicPeopleSearch = classicPeopleSearchParams.primary;
          if (classicPeopleSearchParams.strategies?.length) {
            generatedParameters.classicPeopleSearchStrategies = classicPeopleSearchParams.strategies;
          }
        } else if (searchType === 'sales_navigator') {
          const salesNavigatorPeopleSearchParams = peopleSearchParams as SalesNavigatorPeopleSearchGenerationResult;
          generatedParameters.salesNavigatorPeopleSearch = salesNavigatorPeopleSearchParams.primary;
          if (salesNavigatorPeopleSearchParams.strategies?.length) {
            generatedParameters.salesNavigatorPeopleSearchStrategies = salesNavigatorPeopleSearchParams.strategies;
          }
        } else if (searchType === 'recruiter') {
          const recruiterPeopleSearchParams = peopleSearchParams as RecruiterPeopleSearchGenerationResult;
          generatedParameters.recruiterPeopleSearch = recruiterPeopleSearchParams.primary;
          if (recruiterPeopleSearchParams.strategies?.length) {
            generatedParameters.recruiterPeopleSearchStrategies = recruiterPeopleSearchParams.strategies;
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


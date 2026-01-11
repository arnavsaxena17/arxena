import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { graphqlToFindManySearchFilters, UpdateOneSearchFilter } from 'twenty-shared';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { classicPeopleSearchSchema } from '../schemas/classic-people-search.schema';
import { recruiterPeopleSearchSchema } from '../schemas/recruiter-people-search.schema';
import { salesNavigatorPeopleSearchSchema } from '../schemas/sales-navigator-people-search.schema';
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
import { CandidateSearchStreamingService } from './candidate-search-streaming.service';
import { JobDescriptionService } from './job-description.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { QueryUnderstandingService } from './query-understanding.service';
import { SearchExecutionService } from './search-execution.service';
import { StrategyEvolutionService } from './strategy-evolution.service';

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
    private readonly candidateSearchStreamingService: CandidateSearchStreamingService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly jobDescriptionService: JobDescriptionService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly strategyEvolution: StrategyEvolutionService,
  ) {}

  async handleSearchParametersAndResultsGenerationStream(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
    precomputedQueryUnderstanding?: QueryUnderstanding,
    skipClarificationCheck: boolean = false,
    isClarificationResponse: boolean = false,
    clarificationQuestions?: string[],
    clarificationAnswers?: string,
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
        classificationReasoning,
      );
      this.logger.log(`Generated context:: ${JSON.stringify(context, null, 2)}`);

      // Check for refinement intent first
      let isRefinement = false;
      if (userMessage) {
        isRefinement = await this.detectRefinementIntent(
          userMessage,
          searchFilterId,
          apiToken,
        );
      }

      // Extract query understanding if user message is available - CHECK BEFORE GENERATING PARAMETERS
      let queryUnderstanding: QueryUnderstanding | undefined = precomputedQueryUnderstanding;
      if (!queryUnderstanding && userMessage) {
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
            clarificationQuestions,
            clarificationAnswers,
          );
        } catch (error) {
          this.logger.warn(`Failed to extract query understanding: ${error}`);
        }
      }

      // Check if clarification is needed - RETURN EARLY if so (unless we're skipping the check)
      if (!skipClarificationCheck && queryUnderstanding?.needsClarification && !isRefinement) {
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

      const { generatedParamsAndStrategies, resolvedParams } =
        await this.generateAndResolvedSearchParameters(
          parsedJD,
          searchType,
          searchCategory,
          context.searchParamKey,
          context.accountId,
          context.jobId,
          apiToken,
          userMessage,
          classificationReasoning,
          sendEvent,
          includeJd,
          queryUnderstanding, // Pass queryUnderstanding to avoid re-computation
        );

      this.logger.log(`Generated and resolved search parameters:: ${JSON.stringify(generatedParamsAndStrategies, null, 2)}`);
      this.logger.log(`Resolved parameters:: ${JSON.stringify(resolvedParams, null, 2)}`);
      
      const strategies = this.extractStrategiesFromGeneratedParams(
        generatedParamsAndStrategies,
        searchType,
        searchCategory,
      );

      this.logger.log(`Strategies:: ${JSON.stringify(strategies, null, 2)}`)

      // Handle refinement if detected
      if (isRefinement && userMessage) {
        return await this.handleSearchRefinement(
          searchFilterId,
          parsedJD,
          searchType,
          searchCategory,
          userMessage,
          apiToken,
          sendEvent,
          includeJd,
        );
      }

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
      const primaryParams = generatedParamsAndStrategies[context.searchParamKey] || 
                           (generatedParamsAndStrategies as any).primary;
      const hasPrimaryParams = !!primaryParams;
      
      if (strategyResults.length === 0 && hasPrimaryParams) {
        this.logger.log('No strategies found, executing search for primary parameters');
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
            sendEvent?.('status', { message: 'Resolving parameter IDs...' });
            const resolved = await this.linkedinParameterResolver.resolveParameterIds(
              primaryParams,
              searchType,
              searchCategory,
              context.accountId,
            );
            resolvedPrimaryParams = {
              [context.searchParamKey]: resolved[context.searchParamKey] || resolved,
            } as GeneratedSearchParameters;
          }

          // Get resolved parameters for the strategy (use resolved version if available)
          const strategyParameters = resolvedPrimaryParams[context.searchParamKey] || primaryParams;

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

          this.logger.log(`Primary search completed: ${searchPreview?.itemCount || 0} candidates found`);
        } catch (error) {
          this.logger.error(`Failed to execute primary search: ${error}`);
          strategyResults.push({
            strategy: {
              id: 'primary',
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
        searchFilterId,
        context.searchFilter,
        context.searchParamKey,
        generatedParamsAndStrategies,
        resolvedParams,
        apiToken,
        searchType,
        searchCategory,
        sendEvent,
      );

      const responseData = this.buildSearchParametersResponse(
        generatedParamsAndStrategies,
        resolvedParams,
        context.searchParamKey,
        strategyResults,
        searchType,
        searchCategory,
      );

      this.logger.log(`Response data:: ${JSON.stringify(responseData, null, 2)}`);
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
        data: responseData,
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
        data: responseData,
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
    classificationReasoning?: string,
  ): Promise<{
    accountId: string;
    searchParamKey: string;
    searchFilter: any;
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
    if (classificationReasoning) {
      this.logger.log(`Classification reasoning in prepareSearchContext: ${classificationReasoning}`);
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
    classificationReasoning?: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<{
    generatedParamsAndStrategies: any;
    resolvedParams: any;
  }> {
    sendEvent?.('status', { message: 'Connecting to AI model...' });
    const generatedParamsAndStrategies =
      await this.candidateSearchStreamingService.streamSearchParametersAndStrategies(
        parsedJD,
        searchType,
        searchCategory,
        apiToken!,
        userMessage,
        classificationReasoning,
        jobId,
        sendEvent,
        includeJd,
        queryUnderstanding, // Pass queryUnderstanding to avoid re-computation
      );

    if (!generatedParamsAndStrategies) {
      throw new HttpException(
        'Failed to generate search parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(`searchParamKey:: ${searchParamKey}`);
    // Handle both structures: { primary: {...} } and { classicPeopleSearch: {...} }
    let searchParams = generatedParamsAndStrategies[searchParamKey];
    if (!searchParams && (generatedParamsAndStrategies as any).primary) {
      // If we have primary structure, use that
      searchParams = (generatedParamsAndStrategies as any).primary;
    }
    
    let resolvedParams = {};

    if (!searchParams) {
      this.logger.warn(
        `No search parameters generated for ${searchParamKey}, using empty object`,
      );
    } else {
      sendEvent?.('status', { message: 'Resolving parameter IDs...' });
      const resolved = await this.linkedinParameterResolver.resolveParameterIds(
        searchParams,
        searchType,
        searchCategory,
        accountId,
      );
      // Store resolved params under the searchParamKey for consistency
      resolvedParams = {
        [searchParamKey]: resolved[searchParamKey] || resolved,
      };
    }
    return { generatedParamsAndStrategies, resolvedParams };
  }

  private async updateSearchFilterWithParameters(
    searchFilterId: string,
    searchFilter: any,
    searchParamKey: string,
    generatedParamsAndStrategies: any,
    resolvedParams: any,
    apiToken: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<void> {
    const updatedSearchFilterParameter = {
      ...searchFilter.searchFilterParameter,
      generatedSearchParameters: {
        ...searchFilter.searchFilterParameter?.generatedSearchParameters,
        [searchParamKey]: generatedParamsAndStrategies[searchParamKey],
      },
      resolvedSearchParameters: {
        ...searchFilter.searchFilterParameter?.resolvedSearchParameters,
        [searchParamKey]: resolvedParams,
      },
    };

    sendEvent?.('status', { message: 'Saving parameters...' });
    const chatMessage = `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`;
    await this.addChatMessage(searchFilterId, 'assistant', chatMessage, apiToken);
    await this.updateSearchFilterParameters(
      searchFilter.id,
      updatedSearchFilterParameter,
      searchFilter.chatHistory,
      apiToken,
    );
  }

  private extractStrategiesFromGeneratedParams(
    generatedParamsAndStrategies: any,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): PeopleSearchStrategyResult[] {
    if (searchType === 'classic' && searchCategory === 'people') {
      return generatedParamsAndStrategies.classicPeopleSearchStrategies || [];
    }
    if (searchType === 'sales_navigator' && searchCategory === 'people') {
      return (
        generatedParamsAndStrategies.salesNavigatorPeopleSearchStrategies || []
      );
    }
    if (searchType === 'recruiter' && searchCategory === 'people') {
      return generatedParamsAndStrategies.recruiterPeopleSearchStrategies || [];
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

  private buildSearchParametersResponse(
    generatedParamsAndStrategies: any,
    resolvedParams: any,
    searchParamKey: string,
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      preview: SearchExecutionPreview | null;
    }>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): any {
    const resolvedSearchParametersPayload: GeneratedSearchParameters = {
      [searchParamKey]: resolvedParams,
    } as GeneratedSearchParameters;

    // Generate LinkedIn URL for primary search parameters
    const primaryParams = resolvedParams[searchParamKey] || resolvedParams;
    const primaryLinkedInUrl = generateLinkedInSearchUrl(
      primaryParams,
      searchType,
      searchCategory,
    );

    // Generate LinkedIn URLs for each strategy
    const strategyResultsWithUrls = strategyResults.map((strategyResult) => {
      const strategyParams = strategyResult.strategy?.parameters;
      const strategyLinkedInUrl = strategyParams
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

    const result = {
      generatedSearchParameters: generatedParamsAndStrategies,
      resolvedSearchParameters: resolvedSearchParametersPayload,
      chatMessage: `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
      searchResultsPreview: {
        itemCount: 0,
        searchResults: [],
      } as unknown as SearchExecutionPreview,
      strategyResults:
        strategyResultsWithUrls.length > 0 ? strategyResultsWithUrls : undefined,
      linkedInUrl: primaryLinkedInUrl,
    };

    return 'generatedParams' in result
      ? { generatedParams: result.generatedParams }
      : {
          generatedSearchParameters: result.generatedSearchParameters,
          resolvedSearchParameters: result.resolvedSearchParameters,
          searchResultsPreview: result.searchResultsPreview,
          strategyResults: result.strategyResults,
          linkedInUrl: result.linkedInUrl,
        };
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
      const preview = await this.executeSingleStrategySearch(
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


  private async executeSingleStrategySearch(
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
    try {
      if (!strategy.parameters) {
        this.logger.warn(
          `Strategy ${strategy.id} has no parameters, skipping search preview`,
        );
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      this.logger.log(
        `Executing search preview for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );
      this.logger.log(
        `Strategy ${strategy.id} parameters before resolution: ${JSON.stringify(strategy.parameters, null, 2)}`,
      );

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
      const response =
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
        `Strategy ${strategy.id} preview completed: ${response.searchResults?.items?.length ?? 0} candidates found`,
      );

      return {
        itemCount: response.searchResults?.items?.length ?? 0,
        searchResults: response.searchResults,
        transformedCandidates: response.transformedCandidates,
        searchMetadata: response.searchMetadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
      
      this.logger.error(
        `Failed to execute search preview for strategy ${strategy.id} (${strategy.label || 'unnamed'}):`,
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

    const result = await this.staticGraphQLService.executeGraphQL(
      query,
      { filter: { id: { eq: searchFilterId } } },
      apiToken,
    );

    if (!result.data?.data?.searchFilters?.edges?.[0]?.node) {
      throw new HttpException('Search filter not found', HttpStatus.NOT_FOUND);
    }
    return result.data.data.searchFilters.edges[0].node;
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

  /**
   * Detect if a message is refining a previous search
   */
  private async detectRefinementIntent(
    message: string,
    searchFilterId: string,
    apiToken: string,
  ): Promise<boolean> {
    // Check for refinement keywords
    const refinementKeywords = [
      'more', 'also', 'add', 'refine', 'improve', 'better', 'narrow', 'expand',
      'adjust', 'modify', 'change', 'update', 'tweak', 'enhance', 'further',
      'additionally', 'plus', 'include', 'exclude', 'remove', 'filter',
    ];
    
    const lowerMessage = message.toLowerCase();
    const hasRefinementKeyword = refinementKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (!hasRefinementKeyword) {
      return false;
    }

    // Check chat history for recent search generation
    try {
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const chatHistory = searchFilter.chatHistory || [];
      
      // Look for recent search parameter generation (within last 10 messages)
      const recentMessages = chatHistory.slice(-10);
      const hasRecentSearch = recentMessages.some((msg: any) => 
        msg.role === 'assistant' && 
        (msg.content?.includes('search parameters') || 
         msg.content?.includes('Generated search') ||
         searchFilter.searchFilterParameter?.generatedSearchParameters)
      );

      return hasRecentSearch;
    } catch (error) {
      this.logger.warn(`Failed to check chat history for refinement: ${error}`);
      return false;
    }
  }

  /**
   * Handle search refinement by merging new requirements with existing parameters
   */
  private async handleSearchRefinement(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    userMessage: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
  ): Promise<any> {
    try {
      sendEvent?.('status', { message: 'Refining search parameters...' });

      // Get existing search parameters
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const existingParams = searchFilter.searchFilterParameter?.generatedSearchParameters || {};
      const searchParamKey = constructSearchParamKey(searchType, searchCategory);
      const existingSearchParams = existingParams[searchParamKey];

      if (!existingSearchParams) {
        this.logger.warn('No existing search parameters found for refinement');
        // Fall back to normal generation
        return await this.handleSearchParametersAndResultsGenerationStream(
          searchFilterId,
          parsedJD,
          searchType,
          searchCategory,
          apiToken,
          userMessage,
          undefined,
          sendEvent,
          includeJd,
        );
      }

      // Refine parameters using LLM
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);
      
      const refinedParams = await this.refineSearchParameters(
        openaiClient,
        existingSearchParams,
        userMessage,
        parsedJD,
        searchType,
        searchCategory,
        searchFilter.jobId,
        apiToken,
        sendEvent,
        includeJd,
      );

      // Resolve parameter IDs
      const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(apiToken);
      sendEvent?.('status', { message: 'Resolving parameter IDs...' });
      const resolvedParams = await this.linkedinParameterResolver.resolveParameterIds(
        refinedParams,
        searchType,
        searchCategory,
        accountId,
      );

      // Update search filter
      const updatedSearchFilterParameter = {
        ...searchFilter.searchFilterParameter,
        generatedSearchParameters: {
          ...searchFilter.searchFilterParameter?.generatedSearchParameters,
          [searchParamKey]: refinedParams,
        },
        resolvedSearchParameters: {
          ...searchFilter.searchFilterParameter?.resolvedSearchParameters,
          [searchParamKey]: resolvedParams,
        },
      };

      await this.updateSearchFilterParameters(
        searchFilterId,
        updatedSearchFilterParameter,
        searchFilter.chatHistory,
        apiToken,
      );

      sendEvent?.('message', {
        success: true,
        type: 'search_parameters',
        data: {
          generatedSearchParameters: { [searchParamKey]: refinedParams },
          resolvedSearchParameters: { [searchParamKey]: resolvedParams },
        },
        chatMessage: `Refined search parameters for ${searchType} ${searchCategory} search based on your feedback.`,
      });

      return {
        success: true,
        type: 'search_parameters',
        data: {
          generatedSearchParameters: { [searchParamKey]: refinedParams },
          resolvedSearchParameters: { [searchParamKey]: resolvedParams },
        },
        chatMessage: `Refined search parameters for ${searchType} ${searchCategory} search based on your feedback.`,
      };
    } catch (error) {
      this.logger.error('Error refining search parameters:', error);
      sendEvent?.('error', {
        error: `Failed to refine search parameters: ${error.message}`,
        chatMessage: `Sorry, I couldn't refine the search parameters: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Refine search parameters by merging new requirements with existing ones
   */
  private async refineSearchParameters(
    openaiClient: OpenAI,
    existingParams: any,
    userMessage: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    jobId?: string,
    apiToken?: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
  ): Promise<any> {
    const rawJDText = includeJd && jobId && apiToken
      ? await this.candidateSearchStreamingService['jobDescriptionService'].getJDContentFromJobAttachments(jobId, apiToken)
      : '';

    const refinementPrompt = this.searchParametersPrompts.buildRefinementPrompt(
      existingParams,
      userMessage,
      parsedJD,
      includeJd ? rawJDText : '',
      searchType,
      searchCategory,
    );

    const systemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
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

    sendEvent?.('status', { message: 'Generating refined parameters...' });

    const stream = await this.candidateSearchStreamingService['createStreamingCompletion'](
      openaiClient,
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: refinementPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.candidateSearchStreamingService['processStreamChunks'](stream, sendEvent);

    if (!fullContent) {
      this.logger.warn('Parameter refinement returned empty content, using existing parameters.');
      return existingParams;
    }

    try {
      const parsed = JSON.parse(fullContent);
      this.logger.log(`Refined parameters: ${JSON.stringify(parsed, null, 2)}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Failed to parse refined parameters: ${error}`);
      return existingParams;
    }
  }

  /**
   * Store clarification context for later retrieval
   */
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
}


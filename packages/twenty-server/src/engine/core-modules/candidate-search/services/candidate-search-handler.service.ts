import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { SearchParameterGenerationService } from 'src/engine/core-modules/candidate-search/services/search-parameter-generation.service';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';
import { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { PythonOrgChartService } from 'src/engine/core-modules/org-chart/services/python-org-chart.service';
import {
  findOneAssistantThread,
  OrgChartData,
  updateOneAssistantThread,
} from 'twenty-shared';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import { ChatMessageRequest } from '../types/search-plan.types';
import { calculateCost } from '../utils/cost-calculation.util';

/** Thread context from assistantThread used where searchFilter was previously used. */
type AssistantThreadContext = {
  id: string;
  jobId?: string;
  messages: Array<{ role: string; content: string; toolCalls?: unknown }>;
  assistantParameters?: {
    generatedSearchParameters?: Record<string, unknown>;
    resolvedSearchParameters?: Record<string, unknown>;
    pendingClarification?: { questions: string[]; timestamp?: string };
    [key: string]: unknown;
  };
  enrichmentConfigs?: Array<{ id: string; selectedModel?: string; [key: string]: unknown }>;
};
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../utils/linkedin-query-generation-mapper.util';
import { hasMeaningfulOrgChartFunctionRootFilter } from '../utils/orgchart-filter.util';
import { constructSearchParamKey, generateLinkedInSearchUrl } from '../utils/search-parameter.utils';
import { TokenUsage } from '../utils/token-tracking.util';
import { BooltreeHintService } from './booltree-hint.service';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { ClassifyMessageService } from './classify-message.service';
import { CleanupService } from './cleanup.service';
import { CompanyExpanderService } from './company-expander.service';
import { JobDescriptionService } from './job-description.service';
import { JobTitleExpanderService } from './job-title-expander.service';
import { OrgchartCancelRegistryService } from './orgchart-cancel-registry.service';
import { PythonQueryGenerationService } from './python-query-generation.service';
import { QueryConstructorService } from './query-constructor.service';
import { RequirementAnalyzerService } from './requirement-analyzer.service';
import { SearchExecutionService } from './search-execution.service';

import type { TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';

export type HandlerMessageStreamSendEvent = (event: string, data: Record<string, unknown>) => boolean | void;

export type HandleMessageStreamResult = {
  response: {
    success?: boolean;
    type?: string;
    data?: {
      strategyResults?: Array<{ preview?: { transformedCandidates?: unknown[] } }>;
    };
    chatMessage?: string;
    error?: string;
  };
  assistantMessage: string | null;
};

const DEFAULT_PARSED_JD_MESSAGE_STREAM: ParsedJobDescription = {
  jobTitle: '',
  company: '',
  location: '',
  industry: '',
  requiredSkills: [],
  preferredSkills: [],
  experienceLevel: 'mid_level',
  education: [],
  keywords: [],
  responsibilities: [],
  qualifications: [],
  benefits: [],
  employmentType: 'full_time',
  remoteWork: false,
  salaryRange: null,
};

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

type CachedCompanyOrgChartPayload = {
  companyId: string;
  companyName: string;
  mode: 'entire_company';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  orgChart: OrgChartData;
  items: any[];
  itemCount: number;
  cachedAt: string;
  /** True if credits were debited when this org chart was created. Undefined = legacy cache (treated as true). */
  creditsDebited?: boolean;
};

type CachedCompanyCandidateListPayload = {
  companyId: string;
  companyName: string;
  mode: 'entire_company';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  items: any[];
  itemCount: number;
  cachedAt: string;
};

type CachedFunctionGradeSearchPayload = {
  companyId: string;
  companyName: string;
  functionRoot: string;
  country: string;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  strategyCap: number;
  keywordsHash: string;
  items: any[];
  itemCount: number;
  orgChart?: OrgChartData;
  cachedAt: string;
};

type OrgChartCandidateInput = TransformedCandidateForTable | Record<string, unknown>;

type StandardizedOrgChartPerson = {
  full_name: string;
  job_title: string;
  job_company_linkedin_url: string;
  job_company_id: string;
  job_company_name: string;
  industry: string;
  country: string;
  job_company_website: string;
  linkedin_url: string;
  facebook_url: string;
  twitter_url: string;
  gender: string;
  location_country: string;
  location_region: string;
  location_locality: string;
  location_metro: string;
  location_name: string;
  inferred_salary: string;
  inferred_years_experience: string;
  emails: string;
  phone_numbers: string;
  profile_picture_url: string;
  id: string;
};

const ORG_CHART_COMPANY_CACHE_KEY_PREFIX = 'company-orgchart';
const ORG_CHART_COMPANY_CANDIDATE_LIST_CACHE_KEY_PREFIX =
  'company-orgchart-candidates';
const ORG_CHART_FUNCTION_GRADE_CACHE_KEY_PREFIX = 'function-grade-orgchart';
const DEFAULT_ORG_CHART_COMPANY_CACHE_TTL_SECONDS = 60 * 60 * 24 * 90;;
const DEFAULT_ORG_CHART_COMPANY_CANDIDATES_CACHE_TTL_SECONDS =
  60 * 60 * 24 * 90;
const DEFAULT_ORG_CHART_FUNCTION_GRADE_CACHE_TTL_SECONDS =
  60 * 60 * 24 * 30;
const THREE_MONTHS_IN_MS = 1000 * 60 * 60 * 24 * 90;
const DEFAULT_ORG_CHART_MIN_PEOPLE_TO_CACHE = 3;

@Injectable()
export class CandidateSearchHandlerService {
  private readonly logger = new Logger(CandidateSearchHandlerService.name);

  constructor(
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly jobDescriptionService: JobDescriptionService,
    private readonly searchParameterGenerationService: SearchParameterGenerationService,
    private readonly requirementAnalyzerService: RequirementAnalyzerService,
    private readonly jobTitleExpanderService: JobTitleExpanderService,
    private readonly companyExpanderService: CompanyExpanderService,
    private readonly booltreeHintService: BooltreeHintService,
    private readonly queryConstructorService: QueryConstructorService,
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly pythonOrgChartService: PythonOrgChartService,
    private readonly classifyMessageService: ClassifyMessageService,
    private readonly cleanupService: CleanupService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly orgChartCacheStorageService: CacheStorageService,
    private readonly orgchartCancelRegistry: OrgchartCancelRegistryService,
  ) {}

  async handleSearchParametersAndResultsGenerationStream(
    rawQuery: string,
    cleanedQuery: string,
    assistantThreadId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
    apiToken: string,
    userMessage: string,
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
        assistantThreadId,
        searchType,
        searchCategory,
        apiToken,
        userMessage,
      );
      this.logger.log(`Generated context:: ${JSON.stringify(context, null, 2)}`);

      let preUnresolved: GeneratedSearchParameters | undefined;

      if (searchCategory !== 'people') {
        throw new HttpException(
          'Only people search is supported; use the multi-agent flow.',
          HttpStatus.BAD_REQUEST,
        );
      }

      preUnresolved =
        await this.generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
          cleanedQuery || rawQuery,
          searchType,
          sendEvent,
        );
      this.logger.log(`Pre-unresolved search parameters:: ${JSON.stringify(preUnresolved, null, 2)}`);
      if (!preUnresolved || Object.keys(preUnresolved).length === 0) {
        throw new HttpException(
          'Multi-agent flow did not produce search parameters',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const searchResult = await this.generateAndExecuteSearchParameters(
        rawQuery,
        cleanedQuery,
        parsedJD,
        searchType,
        searchCategory,
        context,
        apiToken,
        userMessage,
        sendEvent,
        includeJd,
        accumulateTokens,
        preUnresolved,
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

  /**
   * Multi-agent flow: Agent 1 (Requirement Analyzer) → Agents 2 & 3 (Job Title + Company Expander) in parallel → Agent 4 (Query Constructor) → map to unresolved params.
   */
  // private async runMultiAgentFlow(
  //   rawQuery: string,
  //   cleanedQuery: string,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
  //   apiToken: string,
  //   sendEvent?: (event: string, data: any) => void,
  //   accumulateTokens?: (usage: TokenUsage) => void,
  // ): Promise<GeneratedSearchParameters> {
  //   return this.generateSearchParametersFromLinkedinQueryGeneration(
  //     cleanedQuery || rawQuery,
  //     searchType,
  //     sendEvent,
  //   );
  // }

  async generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
    requirement: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<GeneratedSearchParameters> {
    this.logger.log(`Generating search parameters from LinkedIn query generation...`);
    sendEvent?.('status', {
      message: 'Running LinkedIn query generation flow...',
    });

    this.logger.log(`Running LinkedIn query generation flow...`);
    const orchestratorResult =
      await this.linkedinQueryGenerationService.generateSearchQuerySet(
        requirement,
        {
          verbose: process.env.LINKEDIN_QUERY_GENERATION_VERBOSE === 'true',
          sendEvent,
        },
      );


    sendEvent?.('message', {
      type: 'orchestrator_result',
      data: orchestratorResult,
    });

    const unresolved = mapLinkedinSearchQueriesToGeneratedParameters(
      orchestratorResult.final_query_set,
      searchType,
      requirement,
    );
    sendEvent?.('message', {
      type: 'unresolved_search_parameters',
      data: unresolved,
    });
    sendEvent?.('status', {
      message: `Produced unresolved search parameters:: ${JSON.stringify(unresolved, null, 2)}`,
    });

    this.logger.log(
      `[LinkedIn Query Generation] Produced unresolved search parameters:: ${JSON.stringify(
        unresolved,
        null,
        2,
      )}`,
    );

    return unresolved;
  }

  private async generateAndExecuteSearchParameters(
    rawQuery: string,
    cleanedQuery: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people'  ,
    context: {
      accountId: string;
      searchParamKey: string;
      searchFilter: AssistantThreadContext;
      jobId?: string;
    },
    apiToken: string,
    userMessage: string,
    sendEvent: ((event: string, data: any) => void) | undefined,
    includeJd: boolean,
    accumulateTokens: (usage?: TokenUsage) => void,
    preUnresolved?: GeneratedSearchParameters,
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
        rawQuery,
        cleanedQuery,
        parsedJD,
        searchType,
        searchCategory,
        context.searchParamKey,
        context.accountId,
        userMessage,
        context.jobId,
        apiToken,
        sendEvent,
        includeJd,
        accumulateTokens,
        preUnresolved,
      );

    this.logger.log(`[Strategy] Generated unresolved search parameters:: ${JSON.stringify(unresolvedSearchParams, null, 2)}`); 
    this.logger.log(`[Strategy] Resolved parameters:: ${JSON.stringify(resolvedParams, null, 2)}`);
    
    const strategies = this.extractStrategiesFromGeneratedParams(
      unresolvedSearchParams,
      searchType,
      searchCategory,
    );

    this.logStrategies(strategies);

    let strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }> = [];


    // if (process.env.SEARCH_TESTING_MODE === 'true') {
      // strategyResults = strategies.map((strategy) => ({
      //   strategy,
      //   result: null,
      // }));
    // } else {
      strategyResults = await this.executeStrategySearches(
        parsedJD,
        strategies,
        searchType,
        searchCategory,
        context.searchParamKey,
        apiToken,
        userMessage,
        sendEvent,
      );

      await this.updateAssistantThreadWithParameters(
        context.searchFilter,
        context.searchParamKey,
        unresolvedSearchParams,
        resolvedParams,
        apiToken,
        sendEvent,
      );
    // }

    return {
      unresolvedSearchParams,
      resolvedParams,
      strategyResults,
    };
  }

  private logStrategies(strategies: PeopleSearchStrategyResult[]): void {
    this.logger.log(`Strategies extracted: ${strategies.length} strategies found`);
    strategies.forEach((strategy) => {
      this.logger.log(`[Strategy: ${strategy.id}] Strategy details: ${JSON.stringify({ id: strategy.id, label: strategy.label }, null, 2)}`);
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
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
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

    // this.logger.log(`Resolved search parameters response:: generatedSearchParameters:: ${JSON.stringify(resolvedSearchParametersResponse.generatedSearchParameters.classicPeopleSearchStrategies, null, 2)}`);
    this.logger.log(`Resolved search parameters response:: strategyResults:: ${JSON.stringify(resolvedSearchParametersResponse?.strategyResults?.map(strategy => strategy.strategy), null, 2)}`);
    
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
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
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
    this.logger.error('Error generating search parameters in handle search error:', error);
    
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
    assistantThreadId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
  ): Promise<{
    accountId: string;
    searchParamKey: string;
    searchFilter: AssistantThreadContext;
    jobId?: string;
  }> {
    const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(
      apiToken,
    );
    const searchParamKey = constructSearchParamKey(searchType, searchCategory);
    const searchFilter = await this.getAssistantThreadContext(
      assistantThreadId,
      apiToken,
    );
    const jobId = searchFilter?.jobId;

    this.logger.log(`assistantThread context:: ${JSON.stringify(searchFilter, null, 2)}`);
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
    rawQuery: string,
    cleanedQuery: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchParamKey: string,
    accountId: string,
    userMessage: string,
    jobId?: string,
    apiToken?: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
    onTokenUsage?: (usage: TokenUsage) => void,
    preUnresolved?: GeneratedSearchParameters,
  ): Promise<{
    unresolvedSearchParams: GeneratedSearchParameters;
    resolvedParams: GeneratedSearchParameters;
  }> {
    const strategyId = 'primary';
    this.logger.log(`[Strategy: ${strategyId}] Generating and resolving search parameters for ${searchParamKey}`);
    
    const unresolvedSearchParams = preUnresolved ?? await this.generateUnresolvedSearchParams(
      rawQuery,
      cleanedQuery,
      searchType,
      searchCategory,
      apiToken!,
      userMessage,
      parsedJD,
      jobId,
      sendEvent,
      includeJd,
      onTokenUsage,
    );
    if (!preUnresolved) {
      sendEvent?.('status', { message: 'Connecting to AI model...' });
    }

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
      let resolvedSearchParameters: GeneratedSearchParameters = {};
      if (process.env.SEARCH_TESTING_MODE === 'true') {
        resolvedSearchParameters = {
          // [searchParamKey]: searchParams[searchParamKey],
        };
      } else {
        resolvedSearchParameters = await this.linkedinParameterResolver.resolveParameterIds(
          searchParams,
          accountId,
          strategyId,
        );
      }
      // Store resolved params under the searchParamKey for consistency
      resolvedParams = {
        [searchParamKey]: resolvedSearchParameters[searchParamKey] || resolvedSearchParameters,
      };
      this.logger.log(`[Strategy: ${strategyId}] Completed resolving search parameters`);
    }
    return { unresolvedSearchParams, resolvedParams };
  }

  private async updateAssistantThreadWithParameters(
    threadContext: AssistantThreadContext,
    searchParamKey: string,
    searchParams: GeneratedSearchParameters,
    resolvedParams: GeneratedSearchParameters,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<void> {
    const updatedAssistantParameters = {
      ...threadContext.assistantParameters,
      generatedSearchParameters: {
        ...threadContext.assistantParameters?.generatedSearchParameters,
        [searchParamKey]: searchParams[searchParamKey],
      },
      resolvedSearchParameters: {
        ...threadContext.assistantParameters?.resolvedSearchParameters,
        [searchParamKey]: resolvedParams,
      },
    };

    sendEvent?.('status', { message: 'Saving parameters...' });
    await this.updateAssistantThreadParameters(
      threadContext.id,
      updatedAssistantParameters,
      threadContext.messages,
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
    userMessage: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    Array<{ strategy: PeopleSearchStrategyResult; result: SearchExecutionResult | null }>
  > {
    this.logger.log(
      `Found ${strategies.length} strategies to execute searches for ${searchType} ${searchCategory}`,
    );

    // Limit to one strategy for debugging
    const strategyLimit = 1;
    if (strategies.length > strategyLimit) {
      strategies = strategies.slice(0, strategyLimit);
      this.logger.log(`Limited to ${strategyLimit} strategy for debugging`);
    }

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

    // Log comprehensive parameterResults execution metrics
    this.logParameterResultsMetrics(strategyResults);
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
      strategy: PeopleSearchStrategyResult & { linkedInUrl?: string | null; candidateCount?: number };
      preview: SearchExecutionResult | null;
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

      // Extract candidateCount from result
      const candidateCount = strategyResult.result?.itemCount || 0;

      return {
        strategy: {
          ...strategyResult.strategy,
          linkedInUrl: strategyLinkedInUrl,
          candidateCount,
        },
        preview: strategyResult.result,
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
    userMessage: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<SearchExecutionResult | null> {


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
      const originalCompanyNames =
        Array.isArray(strategy.parameters?.company) && strategy.parameters.company.length > 0
          ? (strategy.parameters.company as string[]).filter(
              (c): c is string => typeof c === 'string' && c.trim().length > 0,
            )
          : [];
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

        // When company was requested but resolution returned no IDs, parameterise company as
        // advanced_keywords.company (freetext) so the raw LinkedIn request still sends
        // SEARCH_FILTER_company instead of only relying on keywords.
        const resolvedCompanyIds = Array.isArray(resolvedParams.company) ? resolvedParams.company : [];
        const hasResolvedCompanyIds = resolvedCompanyIds.some(
          (id) => typeof id === 'string' && (/^\d+$/.test(id) || id.includes('urn:li:')),
        );
        if (
          originalCompanyNames.length > 0 &&
          !hasResolvedCompanyIds &&
          parameterKey === 'classicPeopleSearch'
        ) {
          const companyFallback = originalCompanyNames[0].trim();
          const classicParams = resolvedParams as {
            advanced_keywords?: { company?: string; title?: string; [k: string]: unknown };
            [k: string]: unknown;
          };
          const paramsWithCompanyFallback = {
            ...resolvedParams,
            advanced_keywords: {
              ...(classicParams.advanced_keywords ?? {}),
              company: companyFallback,
            },
          };
          strategy.parameters = paramsWithCompanyFallback as typeof strategy.parameters;
          strategyResolvedParams[parameterKey] = paramsWithCompanyFallback as (typeof strategyResolvedParams)[typeof parameterKey];
          this.logger.log(
            `[Strategy: ${strategyId}] Company not resolved to IDs; using advanced_keywords.company="${companyFallback}"`,
          );
        }
      } else {
        this.logger.log(`[Strategy: ${strategyId}] Parameters already resolved, skipping resolution`);
      }

      // Use multi-page search with query understanding
        const searchResult: SearchExecutionResult | null = await this.searchExecutionService.executeMultiPageStrategySearch(
          parsedJobDescription,
          strategy,
          searchType,
          searchCategory,
          parameterKey,
          apiToken,
          userMessage,
          sendEvent,
        );

        // Log strategy results summary
        if (searchResult) {
          const totalCount = searchResult.searchResults?.paging?.total_count ?? searchResult.itemCount;
          const totalPages = searchResult.searchResults?.paging?.total_count 
            ? Math.ceil(searchResult.searchResults.paging.total_count / 25)
            : undefined;
          
          this.logger.log(
            `Strategy ${strategy.id} (${strategy.label || 'unnamed'}) results: ` +
            `${searchResult.itemCount} candidates fetched, ` +
            `Total available: ${totalCount}, ` +
            `Total pages available: ${totalPages ?? 'unknown'}`,
          );
        }

        // NOTE: Remove this debug logging before production push!
        // Log candidate names and job titles for the search result of the strategy
        // Prefer using the internal logger per code style rules
        this.logger.log(
          `searchResult from multi page search for strategy: ${strategy.label} :: ` +
          JSON.stringify(
            searchResult?.transformedCandidates?.map(item => {
              let name: string;
              let jobTitle: string | undefined;
              if ('name' in item && typeof item.name === 'string') {
                name = item.name;
                jobTitle = (item as { jobTitle?: string }).jobTitle;
              } else {
                // Fallback for LinkedInPeopleSearchResult
                const typed = item as unknown as LinkedInPeopleSearchResult;
                name = (typed.first_name ?? '') + ' ' + (typed.last_name ?? '');
                jobTitle = (typed as unknown as LinkedInPeopleSearchResult)?.headline;
              }
              return { 
                name: name || 'Unknown', 
                jobTitle: jobTitle || 'Unknown'
              };
            }),
            null,
            2
          )
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
  async getAssistantThreadContext(
    assistantThreadId: string,
    apiToken: string,
  ): Promise<AssistantThreadContext> {
    const graphQLResponse = await this.staticGraphQLService.executeGraphQL(
      findOneAssistantThread,
      { id: assistantThreadId },
      apiToken,
    );

    const node = graphQLResponse?.data?.data?.assistantThread;
    if (!node) {
      throw new HttpException('Assistant thread not found', HttpStatus.NOT_FOUND);
    }

    const messages = Array.isArray(node.messages)
      ? (node.messages as Array<{ role: string; content: string; toolCalls?: unknown }>)
      : [];

    const enrichmentConfigs = Array.isArray(node.enrichmentConfigs)
      ? (node.enrichmentConfigs as AssistantThreadContext['enrichmentConfigs'])
      : undefined;

    return {
      id: node.id,
      jobId: node.jobId ?? undefined,
      messages,
      assistantParameters:
        node.assistantParameters && typeof node.assistantParameters === 'object'
          ? (node.assistantParameters as AssistantThreadContext['assistantParameters'])
          : undefined,
      enrichmentConfigs,
    };
  }

  async addChatMessage(
    assistantThreadId: string,
    role: 'user' | 'assistant',
    content: string,
    apiToken: string,
  ): Promise<void> {
    const thread = await this.getAssistantThreadContext(assistantThreadId, apiToken);
    const newMessage = { role, content };
    const updatedMessages = [...thread.messages, newMessage];
    await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
      { id: assistantThreadId, input: { messages: updatedMessages } },
      apiToken,
    );
  }

  /**
   * Handle the full message/stream flow: get search filter, classify, branch, run search.
   * Used by both POST message/stream (controller) and assistant in-process streaming.
   * parsedJD is optional; when omitted or partial, DEFAULT_PARSED_JD_MESSAGE_STREAM is used.
   */
  async handleMessageStream(
    body: Omit<ChatMessageRequest, 'parsedJD'> & {
      parsedJD?: ParsedJobDescription | Record<string, unknown> | null;
    },
    apiToken: string,
    sendEvent: HandlerMessageStreamSendEvent,
  ): Promise<HandleMessageStreamResult> {
    const parsedJD: ParsedJobDescription =
      body.parsedJD && typeof body.parsedJD === 'object' && !Array.isArray(body.parsedJD)
        ? ({ ...DEFAULT_PARSED_JD_MESSAGE_STREAM, ...body.parsedJD } as ParsedJobDescription)
        : DEFAULT_PARSED_JD_MESSAGE_STREAM;

    const thread = await this.getAssistantThreadContext(body.assistantThreadId, apiToken);
    const chatHistory = thread.messages ?? [];

    let rawJDText = '';
    if (body.includeJd !== false && thread.jobId) {
      try {
        rawJDText =
          (await this.jobDescriptionService.getJDContentFromJobAttachments(
            thread.jobId,
            apiToken,
          )) ?? '';
      } catch (err) {
        this.logger.warn(
          `Failed to fetch JD content: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const messageClassification = await this.classifyMessageService.classifyMessage(
      body.message,
      apiToken,
      chatHistory as Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>,
      rawJDText,
    );

    this.logger.log(
      `Message classified as: ${messageClassification.type} (confidence: ${messageClassification.confidence})`,
    );

    if (
      !sendEvent('classification', {
        type: messageClassification.type,
        confidence: messageClassification.confidence,
        reasoning: messageClassification.reasoning,
      } as Record<string, unknown>)
    ) {
      return { response: {}, assistantMessage: null };
    }

    let response: HandleMessageStreamResult['response'] = {};
    let assistantMessage: string | null = null;

    switch (messageClassification.type) {
      case 'clarification_response': {
        const pendingClarification = thread.assistantParameters?.pendingClarification;
        const clarificationQuestions = pendingClarification?.questions ?? [];
        const previousUserMessages = chatHistory.filter((msg: { role: string }) => msg.role === 'user');
        const originalQuery =
          previousUserMessages.length > 1
            ? previousUserMessages[previousUserMessages.length - 2]?.content
            : previousUserMessages[previousUserMessages.length - 1]?.content ?? body.message;
        const combinedQuery =
          this.searchParametersPrompts.buildClarificationResponseCombinedUserQuery(
            originalQuery,
            clarificationQuestions,
            body.message,
          );
        const cleanedCombinedQuery = await this.cleanupService.cleanupQuery(
          combinedQuery,
          apiToken,
        );
        response = await this.handleSearchParametersAndResultsGenerationStream(
          body.message,
          cleanedCombinedQuery,
          body.assistantThreadId,
          parsedJD,
          body.searchType ?? 'classic',
          body.searchCategory ?? 'people',
          apiToken,
          combinedQuery,
          sendEvent as (event: string, data: unknown) => void,
          body.includeJd !== false,
          true,
        );
        if (response?.chatMessage) assistantMessage = response.chatMessage;
        break;
      }
      case 'search_parameters': {
        const cleanedQuery = await this.cleanupService.cleanupQuery(body.message, apiToken);
        response = await this.handleSearchParametersAndResultsGenerationStream(
          body.message,
          cleanedQuery,
          body.assistantThreadId,
          parsedJD,
          body.searchType ?? 'classic',
          body.searchCategory ?? 'people',
          apiToken,
          body.message,
          sendEvent as (event: string, data: unknown) => void,
          body.includeJd !== false,
          false,
        );
        if (response?.chatMessage) assistantMessage = response.chatMessage;
        break;
      }
      case 'general_help':
        assistantMessage =
          'I can help you with candidate search and recruitment workflows! Here\'s what I can do:\n\n' +
          '🔍 **Search Parameters** - Generate LinkedIn search criteria to find candidates\n' +
          '📊 **AI Filters** - Add AI-powered insights to candidate profiles\n' +
          '🔧 **Filters** - Create filtering strategies to narrow down candidate lists\n' +
          '📈 **Sorts** - Design sorting strategies to prioritize the best candidates\n' +
          '🎯 **Complete Plan** - Generate all components at once for a comprehensive search strategy\n\n' +
          'Try saying "generate search parameters" or "create enrichments" to get started!';
        sendEvent('message', {
          success: true,
          type: 'general_help',
          chatMessage: assistantMessage,
        });
        break;
      default:
        assistantMessage =
          "I didn't understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.";
        sendEvent('message', {
          success: false,
          error: assistantMessage,
          chatMessage: assistantMessage,
        });
    }

    return { response, assistantMessage };
  }

  /** Extract candidates from handler response for MCP tool result shape. */
  extractCandidatesFromResponse(
    response: HandleMessageStreamResult['response'],
  ): Record<string, unknown>[] {
    const strategyResults = response?.data?.strategyResults;
    if (!Array.isArray(strategyResults)) return [];

    const rows: Record<string, unknown>[] = [];
    for (const sr of strategyResults) {
      const candidates = sr.preview?.transformedCandidates;
      if (Array.isArray(candidates)) {
        for (const c of candidates) {
          rows.push(
            typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : { value: c },
          );
        }
      }
    }
    return rows;
  }

  private async updateAssistantThreadParameters(
    assistantThreadId: string,
    updatedAssistantParameters: AssistantThreadContext['assistantParameters'],
    messages: AssistantThreadContext['messages'],
    apiToken: string,
  ): Promise<void> {
    await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
      {
        id: assistantThreadId,
        input: {
          assistantParameters: updatedAssistantParameters ?? undefined,
          messages,
        },
      },
      apiToken,
    );
  }

  private async storeClarificationContext(
    assistantThreadId: string,
    questions: string[],
    apiToken: string,
  ): Promise<void> {
    try {
      const thread = await this.getAssistantThreadContext(assistantThreadId, apiToken);
      const assistantParameters = thread.assistantParameters ?? {};

      const updatedAssistantParameters = {
        ...assistantParameters,
        pendingClarification: {
          questions,
          timestamp: new Date().toISOString(),
        },
      };

      await this.updateAssistantThreadParameters(
        assistantThreadId,
        updatedAssistantParameters,
        thread.messages,
        apiToken,
      );
    } catch (error) {
      this.logger.error(`Failed to store clarification context: ${error}`);
    }
  }


  async generateUnresolvedSearchParams(
    rawQuery: string,
    cleanedQuery: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
    apiToken: string,
    userMessage: string,
    parsedJobDescription?: ParsedJobDescription,
    jobId?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<GeneratedSearchParameters> {
    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const generatedParameters: GeneratedSearchParameters = {};      
      this.logger.log(`Generating search parameters for search type: ${searchType}, search category: ${searchCategory}`);
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

      // Handle people search: use multi-agent flow
      if (searchCategory === 'people') {
        sendEvent?.('status', { message: 'Generating people search parameters...' });
        const multiAgentResult = await this.generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
          rawQuery,
          searchType,
          sendEvent,
        );
        const strategies = multiAgentResult.classicPeopleSearchStrategies
          ?? multiAgentResult.salesNavigatorPeopleSearchStrategies
          ?? multiAgentResult.recruiterPeopleSearchStrategies
          ?? [];
        Object.assign(generatedParameters, multiAgentResult);
        if (strategies.length > 0) {
          if (searchType === 'classic') {
            generatedParameters.classicPeopleSearch = (strategies[0] as ClassicPeopleSearchStrategyResult).parameters;
          } else if (searchType === 'sales_navigator') {
            generatedParameters.salesNavigatorPeopleSearch = (strategies[0] as SalesNavigatorPeopleSearchStrategyResult).parameters;
          } else {
            generatedParameters.recruiterPeopleSearch = (strategies[0] as RecruiterPeopleSearchStrategyResult).parameters;
          }
        }
        return generatedParameters;
      }

      if (searchCategory === 'companies' && (searchType === 'classic' || searchType === 'sales_navigator')) {
        const companiesSearchParams = await this.searchParameterGenerationService.streamCompaniesSearchParameters(
          openaiClient,
          searchType,
          userMessage,
          parsedJobDescription,
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
          openaiClient,
          userMessage,
          parsedJobDescription,
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

  /**
   * Log comprehensive metrics for each parameterResults execution
   */
  private logParameterResultsMetrics(
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>,
  ): void {
    this.logger.log(`\n========== ParameterResults Execution Metrics ==========`);
    this.logger.log(`Total strategies executed: ${strategyResults.length}`);

    let totalCandidates = 0;
    let totalPages = 0;
    let totalResults = 0;
    const strategyMetrics: Array<{
      strategyId: string;
      strategyLabel: string;
      candidateCount: number;
      pageCount: number;
      resultCount: number;
      validationScores: number[];
      averageValidationScore: number;
      averageCandidateScore: number;
      candidateScores: number[];
    }> = [];

    for (const { strategy, result } of strategyResults) {
      if (!result) {
        this.logger.log(
          `[Strategy: ${strategy.id}] ${strategy.label || 'Unnamed'}: No execution result`,
        );
        continue;
      }

      if (result.error) {
        this.logger.log(
          `[Strategy: ${strategy.id}] ${strategy.label || 'Unnamed'}: Error - ${result.error.message}`,
        );
        continue;
      }

      // Extract metrics
      const candidateCount = result.itemCount || 0;
      const resultCount = result.searchResults?.items?.length || candidateCount;
      const totalCountFromAPI = result.searchResults?.paging?.total_count;
      
      // Calculate pages ran: prefer paging.page_count, fallback to validationResults length, then estimate from candidate count
      let pagesRan = 0;
      if (result.searchResults?.paging?.page_count !== undefined) {
        pagesRan = result.searchResults.paging.page_count;
      } else if (result.validationResults && result.validationResults.length > 0) {
        pagesRan = result.validationResults.length;
      } else if (candidateCount > 0) {
        pagesRan = Math.ceil(candidateCount / 25);
      }

      // Extract validation scores
      const validationScores: number[] = [];
      if (result.validationResults && result.validationResults.length > 0) {
        result.validationResults.forEach((vr) => {
          if (vr.validation?.relevanceScore !== undefined) {
            validationScores.push(vr.validation.relevanceScore);
          }
        });
      }
      if (result.overallValidation?.relevanceScore !== undefined) {
        validationScores.push(result.overallValidation.relevanceScore);
      }

      // Extract candidate scores from transformed candidates
      const candidateScores: number[] = [];
      if (result.transformedCandidates && result.transformedCandidates.length > 0) {
        result.transformedCandidates.forEach((candidate) => {
          if (candidate.relevanceScore !== undefined && candidate.relevanceScore !== null) {
            candidateScores.push(candidate.relevanceScore);
          }
        });
      }

      const averageValidationScore = validationScores.length > 0
        ? validationScores.reduce((sum, score) => sum + score, 0) / validationScores.length
        : 0;

      const averageCandidateScore = candidateScores.length > 0
        ? candidateScores.reduce((sum, score) => sum + score, 0) / candidateScores.length
        : 0;

      // Store metrics
      strategyMetrics.push({
        strategyId: strategy.id,
        strategyLabel: strategy.label || 'Unnamed',
        candidateCount,
        pageCount: pagesRan,
        resultCount,
        validationScores,
        averageValidationScore,
        averageCandidateScore,
        candidateScores,
      });

      // Accumulate totals
      totalCandidates += candidateCount;
      totalPages += pagesRan;
      totalResults += resultCount;

      // Log individual strategy details
      this.logger.log(
        `\n[Strategy: ${strategy.id}] ${strategy.label || 'Unnamed'}:`,
      );
      this.logger.log(`  - Candidates: ${candidateCount}`);
      this.logger.log(`  - Results: ${resultCount}${totalCountFromAPI ? ` (Total available: ${totalCountFromAPI})` : ''}`);
      this.logger.log(`  - Pages ran: ${pagesRan}`);
      
      if (validationScores.length > 0) {
        this.logger.log(`  - Validation scores: ${validationScores.map(s => (s * 100).toFixed(2) + '%').join(', ')}`);
        this.logger.log(`  - Average validation score: ${(averageValidationScore * 100).toFixed(2)}%`);
      } else {
        this.logger.log(`  - Validation scores: None`);
      }

      if (candidateScores.length > 0) {
        const minScore = Math.min(...candidateScores);
        const maxScore = Math.max(...candidateScores);
        this.logger.log(`  - Candidate scores: ${candidateScores.length} scored, ` +
          `Average: ${(averageCandidateScore * 100).toFixed(2)}%, ` +
          `Min: ${(minScore * 100).toFixed(2)}%, ` +
          `Max: ${(maxScore * 100).toFixed(2)}%`);
      } else {
        this.logger.log(`  - Candidate scores: None`);
      }

      // Log page-by-page validation if available
      if (result.validationResults && result.validationResults.length > 0) {
        this.logger.log(`  - Page-by-page validation:`);
        result.validationResults.forEach((vr) => {
          const score = vr.validation?.relevanceScore;
          const quality = vr.validation?.qualityAssessment || 'N/A';
          const shouldContinue = vr.validation?.shouldContinuePagination;
          this.logger.log(
            `    Page ${vr.page}: Score ${score !== undefined ? (score * 100).toFixed(2) + '%' : 'N/A'}, ` +
            `Quality: ${quality}, Continue: ${shouldContinue !== undefined ? shouldContinue : 'N/A'}`,
          );
        });
      }
    }

    // Log summary statistics
    this.logger.log(`\n========== Summary Statistics ==========`);
    this.logger.log(`Total candidates across all strategies: ${totalCandidates}`);
    this.logger.log(`Total pages ran across all strategies: ${totalPages}`);
    this.logger.log(`Total results across all strategies: ${totalResults}`);

    if (strategyMetrics.length > 0) {
      // Calculate averages per strategy
      const avgCandidatesPerStrategy = totalCandidates / strategyMetrics.length;
      const avgPagesPerStrategy = totalPages / strategyMetrics.length;
      const avgResultsPerStrategy = totalResults / strategyMetrics.length;

      const allValidationScores = strategyMetrics.flatMap(m => m.validationScores);
      const avgValidationScoreAcrossStrategies = allValidationScores.length > 0
        ? allValidationScores.reduce((sum, score) => sum + score, 0) / allValidationScores.length
        : 0;

      const allCandidateScores = strategyMetrics.flatMap(m => m.candidateScores);
      const avgCandidateScoreAcrossStrategies = allCandidateScores.length > 0
        ? allCandidateScores.reduce((sum, score) => sum + score, 0) / allCandidateScores.length
        : 0;

      this.logger.log(`\nAverage per strategy:`);
      this.logger.log(`  - Candidates: ${avgCandidatesPerStrategy.toFixed(2)}`);
      this.logger.log(`  - Pages: ${avgPagesPerStrategy.toFixed(2)}`);
      this.logger.log(`  - Results: ${avgResultsPerStrategy.toFixed(2)}`);
      this.logger.log(`  - Average validation score: ${(avgValidationScoreAcrossStrategies * 100).toFixed(2)}%`);
      this.logger.log(`  - Average candidate score: ${(avgCandidateScoreAcrossStrategies * 100).toFixed(2)}%`);

      // Log per-strategy breakdown
      this.logger.log(`\nPer-strategy breakdown:`);
      strategyMetrics.forEach((metrics) => {
        this.logger.log(
          `  ${metrics.strategyLabel} (${metrics.strategyId}): ` +
          `${metrics.candidateCount} candidates, ` +
          `${metrics.pageCount} pages, ` +
          `${metrics.resultCount} results, ` +
          `Avg validation: ${(metrics.averageValidationScore * 100).toFixed(2)}%, ` +
          `Avg candidate score: ${(metrics.averageCandidateScore * 100).toFixed(2)}%`,
        );
      });
    }

    this.logger.log(`\n==========================================\n`);
  }

  /**
   * Lightweight helper for org-chart integrations:
   * Given a natural-language requirement (built from company + mode),
   * execute a LinkedIn people search and return transformed candidates.
   *
   * For "all people in a company" modes, this method skips the full multi-agent
   * flow and instead uses a simple company-filter strategy to reduce latency
   * and LLM usage.
   */
  async runOrgchartLinkedInSearch(
    rawQuery: string,
    cleanedQuery: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
    options?: {
      mode?: string;
      companyName?: string;
      companyId?: string;
      requestId?: string;
      jobTitles?: string[];
      country?: string;
      functionRoot?: string;
    },
  ): Promise<{
    items: any[];
    itemCount: number;
    isCached?: boolean;
    cacheSource?: 'none' | 'function_grade';
    orgChart?: OrgChartData;
    functionGradeCacheMeta?: {
      strategyCap: number;
      keywordsHash: string;
      functionRoot: string;
      country: string;
    };
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>;
  }> {
    const searchCategory: 'people' = 'people';
    const searchParamKey = this.getSearchParamKey(searchType, searchCategory);
    const parameterKey = searchParamKey;

    const requirement = cleanedQuery || rawQuery;

    // Decide whether we can skip the full multi-agent flow.
    const mode = options?.mode;
    const primaryCompanyName = options?.companyName?.trim() || '';
    const primaryCompanyId = options?.companyId?.trim() || '';
    const requestId = options?.requestId;
    const rawCountry = options?.country?.trim() || '';
    const country =
      rawCountry.toLowerCase() === 'global' ? '' : rawCountry;
    const functionRoot = options?.functionRoot?.trim() || '';

    let workspaceMemberId: string | undefined;
    try {
      const authContext =
        await this.workspaceQueryService.accessTokenService.validateToken(
          apiToken,
        );
      workspaceMemberId = authContext.workspaceMemberId;
    } catch {
      this.logger.warn(
        'Unable to resolve workspace member id for orgchart progress events',
      );
    }

    const emitProgress = (
      event: string,
      data: Record<string, unknown>,
    ): boolean | void => {
      if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
        return false;
      }
      sendEvent?.(event, data);

      if (!workspaceMemberId) {
        return;
      }

      this.workspaceQueryService.webSocketService.sendToUser(
        workspaceMemberId,
        'orgchart-search-progress',
        {
          event,
          requestId,
          mode,
          searchType,
          companyName: primaryCompanyName,
          data,
        },
      );
    };

    emitProgress('status', {
      message: `Starting org chart search for ${primaryCompanyName || 'company'}...`,
    });

    const hasAdditionalFilters =
      !!country || hasMeaningfulOrgChartFunctionRootFilter(functionRoot);

    const isAllPeopleInCompanyMode =
      searchType === 'classic' &&
      !!primaryCompanyName &&
      (mode === 'entire_company' || mode === 'all_people') &&
      !hasAdditionalFilters;

    // If we already have a fresh full-company candidate list cached for this
    // company, reuse it for function-grade orgchart searches instead of
    // hitting LinkedIn again. This lets us build a function-scoped org chart
    // by filtering the existing full-company candidates (e.g. human resources
    // at Litify) when the user asks for function-level orgcharts after a
    // full-company run.
    if (
      mode === 'function_grade' &&
      searchType === 'classic' &&
      !!primaryCompanyName
    ) {
      const cachedCandidateList =
        await this.getCachedCompanyCandidateList({
          companyName: primaryCompanyName,
          companyId: primaryCompanyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedCandidateList?.items && Array.isArray(cachedCandidateList.items)) {
        const filteredItems =
          this.filterOrgChartCandidatesByCountryAndFunctionRoot(
            cachedCandidateList.items,
            country,
            functionRoot,
          );

        this.logger.log(
          `OrgchartLinkedInSearch: reusing full-company candidate list cache for function-grade search (company="${primaryCompanyName}", functionRoot="${functionRoot}", country="${rawCountry || 'global'}") with ${filteredItems.length} candidates after filters.`,
        );

        emitProgress('complete', {
          message: `Loaded cached org chart people search with ${filteredItems.length} candidates (from full-company cache).`,
          itemCount: filteredItems.length,
          strategyCount: 0,
          isCached: true,
        });

        return {
          items: filteredItems,
          itemCount: filteredItems.length,
          isCached: true,
          cacheSource: 'function_grade',
          orgChart: undefined,
          functionGradeCacheMeta: undefined,
          strategyResults: [],
        };
      }
    }

    let strategies: PeopleSearchStrategyResult[];
    let parsedJobDescription: ParsedJobDescription;

    if (isAllPeopleInCompanyMode) {
      // Fast path: simple company-filter strategy, no multi-agent pipeline or LLM calls.
      this.logger.log(
        `OrgchartLinkedInSearch: using direct company filter strategy for "${primaryCompanyName}" (mode=${mode}) without multi-agent flow.`,
      );

      const simpleStrategy: ClassicPeopleSearchStrategyResult = {
        id: `orgchart-company-${primaryCompanyName}`,
        label: `All employees from ${primaryCompanyName}`,
        description:
          `Org-chart helper strategy to fetch all employees from ${primaryCompanyName} using a simple company filter.`,
        strategyText: `All employees from ${primaryCompanyName}`,
        originalUserQuery: requirement,
        clarificationQuestions: null,
        clarificationAnswers: null,
        parameters: {
          company: [primaryCompanyName],
        },
      };

      // Parameterize company name via LinkedIn parameter resolver BEFORE executing search,
      // so the actual LinkedIn query uses canonical company IDs/titles.
      try {
        const accountId =
          await this.candidateSearchBaseService.getLinkedInAccountId(
            apiToken,
          );
        const resolvedParams =
          await this.linkedinParameterResolver.resolveParameterIds(
            simpleStrategy.parameters,
            accountId,
            simpleStrategy.id,
          );
        simpleStrategy.parameters = resolvedParams;
      } catch (error) {
        this.logger.error(
          `[Strategy: ${simpleStrategy.id}] Failed to parameterize company name for orgchart search, continuing with raw company value "${primaryCompanyName}"`,
          error as Error,
        );
      }

      strategies = [simpleStrategy];

      // Minimal ParsedJobDescription stub for downstream services
      const primaryTitle = primaryCompanyName
        ? `Employee at ${primaryCompanyName}`
        : 'Employee';

      parsedJobDescription = {
        jobTitle: primaryTitle,
        company: primaryCompanyName,
        location: '',
        industry: '',
        requiredSkills: [],
        preferredSkills: [],
        experienceLevel: 'mid_level',
        education: [],
        keywords: [],
        responsibilities: [],
        qualifications: [],
        benefits: [],
        employmentType: 'full_time',
        remoteWork: false,
        salaryRange: null,
      };
    } else {
      let parsedRequirement: { primary_role_name?: string | null; location?: string | null; industry?: string | null } | undefined;
      const usePythonQueryGenerator =
        process.env.USE_PYTHON_QUERY_GENERATOR_FOR_ORGCHART === 'true' ||
        process.env.USE_PYTHON_QUERY_GENERATOR_FOR_ORGCHART === '1';

      if (usePythonQueryGenerator) {
        emitProgress('status', {
          message: 'Generating LinkedIn search via Python query generator...',
        });
        const pythonInput: import('./python-query-generation.service').PythonQueryInput =
          {
            company_names: primaryCompanyName ? [primaryCompanyName] : [],
          };

        if (functionRoot) {
          pythonInput.function_root = [
            {
              name: functionRoot,
              exclude: false,
            },
          ];
        }

        if (mode === 'leadership') {
          pythonInput.grades = [{ name: 'leadership', exclude: false }];
        } else if (mode === 'function_grade' && options?.jobTitles?.length) {
          pythonInput.raw_job_titles = options.jobTitles;
        } else {
          // pythonInput.grades = [{ name: 'mid', exclude: false }];
        }

        const unresolved =
          await this.pythonQueryGenerationService.generateSearchParameters(
            pythonInput,
            searchType,
            requirement,
          );
        strategies = this.extractStrategiesFromGeneratedParams(
          unresolved,
          searchType,
          searchCategory,
        );
      } else {
        const { tokenAccumulator, accumulateTokens } =
          this.createTokenAccumulator();
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        const { openAIclient: openaiClient } =
          await this.workspaceQueryService.initializeLLMClients(workspaceId);

        emitProgress('status', {
          message: 'Analyzing org-chart requirement...',
        });
        parsedRequirement =
          await this.requirementAnalyzerService.analyzeRequirement(
            rawQuery,
            cleanedQuery,
            openaiClient,
            accumulateTokens,
            sendEvent,
          );

        emitProgress('status', {
          message: 'Generating LinkedIn search strategies...',
        });
        const unresolved =
          await this.generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
            cleanedQuery,
            searchType,
            sendEvent,
          );

        strategies = this.extractStrategiesFromGeneratedParams(
          unresolved,
          searchType,
          searchCategory,
        );
      }
      // Build a minimal ParsedJobDescription stub for downstream services
      const parsedReq = parsedRequirement as { primary_role_name?: string | null; location?: string | null; industry?: string | null } | undefined;
      parsedJobDescription = {
        jobTitle: (parsedReq?.primary_role_name && parsedReq.primary_role_name.trim()) || (primaryCompanyName ? `Role at ${primaryCompanyName}` : 'Employee'),
        company: primaryCompanyName,
        location: parsedReq?.location ?? '',
        industry: parsedReq?.industry ?? '',
        requiredSkills: [],
        preferredSkills: [],
        experienceLevel: 'mid_level',
        education: [],
        keywords: [],
        responsibilities: [],
        qualifications: [],
        benefits: [],
        employmentType: 'full_time',
        remoteWork: false,
        salaryRange: null,
      };
    }

    this.logStrategies(strategies);

    const strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }> = [];

    // For org-chart usage, cap strategies to keep latency and cost bounded.
    // Default remains 1; can be increased with ORGCHART_MAX_STRATEGIES.
    const configuredMaxStrategiesRaw = process.env.ORGCHART_MAX_STRATEGIES;
    const configuredMaxStrategiesParsed =
      configuredMaxStrategiesRaw !== undefined
        ? Number.parseInt(configuredMaxStrategiesRaw, 10)
        : NaN;
    const maxStrategiesToRun =
      Number.isFinite(configuredMaxStrategiesParsed) &&
      configuredMaxStrategiesParsed > 0
        ? configuredMaxStrategiesParsed
        : 1;
    const strategiesToRun =
      strategies.length > 0 ? strategies.slice(0, maxStrategiesToRun) : [];

    this.logger.log(
      `OrgchartLinkedInSearch: strategy execution cap=${maxStrategiesToRun}, extracted=${strategies.length}, executing=${strategiesToRun.length}`,
    );

    const isFunctionGradeMode = mode === 'function_grade';
    const normalizedFunctionRoot = this.normalizeFunctionRoot(functionRoot);
    const normalizedCountry = this.normalizeCountry(country);
    const keywordsHash = this.buildFunctionGradeKeywordsHash(strategiesToRun);

    if (isFunctionGradeMode && primaryCompanyName && normalizedFunctionRoot) {
      const cachedFunctionGrade =
        await this.getCachedFunctionGradeSearch({
          companyName: primaryCompanyName,
          companyId: primaryCompanyId,
          functionRoot: normalizedFunctionRoot,
          country: normalizedCountry,
          searchType,
          strategyCap: maxStrategiesToRun,
          keywordsHash,
        });

      if (cachedFunctionGrade) {
        this.logger.log(
          `OrgchartLinkedInSearch: function-grade cache HIT for company="${primaryCompanyName}", functionRoot="${normalizedFunctionRoot}", country="${normalizedCountry}", strategyCap=${maxStrategiesToRun}`,
        );
        emitProgress('complete', {
          message: `Loaded cached org chart people search with ${cachedFunctionGrade.itemCount} candidates.`,
          itemCount: cachedFunctionGrade.itemCount,
          strategyCount: strategiesToRun.length,
          isCached: true,
        });
        return {
          items: cachedFunctionGrade.items,
          itemCount: cachedFunctionGrade.itemCount,
          isCached: true,
          cacheSource: 'function_grade',
          orgChart: cachedFunctionGrade.orgChart,
          functionGradeCacheMeta: {
            strategyCap: maxStrategiesToRun,
            keywordsHash,
            functionRoot: normalizedFunctionRoot,
            country: normalizedCountry,
          },
          strategyResults: strategiesToRun.map((s) => ({ strategy: s, result: null })),
        };
      }
    }

    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      this.logger.log(
        `Orgchart search aborted by user before execution. requestId=${requestId}`,
      );
      return {
        items: [],
        itemCount: 0,
        strategyResults: strategiesToRun.map((s) => ({ strategy: s, result: null })),
      };
    }

    for (const strategy of strategiesToRun) {
      const preview = await this.searchExecutionService.executeMultiPageSearchWithoutValidation(
        parsedJobDescription,
        strategy,
        searchType,
        searchCategory,
        parameterKey,
        apiToken,
        undefined,
        emitProgress,
      );
      strategyResults.push({ strategy, result: preview as SearchExecutionResult | null });
    }

    const allCandidates =
      strategyResults.flatMap((sr) => sr.result?.transformedCandidates || []);

    this.logger.log(
      `OrgchartLinkedInSearch: collected ${allCandidates.length} transformed candidates from ${strategyResults.length} strategy/strategies.`,
    );

    emitProgress('complete', {
      message: `Completed org chart people search with ${allCandidates.length} candidates.`,
      itemCount: allCandidates.length,
      strategyCount: strategyResults.length,
    });

    if (
      isFunctionGradeMode &&
      primaryCompanyName &&
      normalizedFunctionRoot &&
      allCandidates.length > 0
    ) {
      await this.setCachedFunctionGradeSearch({
        companyName: primaryCompanyName,
        companyId: primaryCompanyId,
        functionRoot: normalizedFunctionRoot,
        country: normalizedCountry,
        searchType,
        strategyCap: maxStrategiesToRun,
        keywordsHash,
        items: allCandidates,
        itemCount: allCandidates.length,
      });
    }

    return {
      items: allCandidates,
      itemCount: allCandidates.length,
      isCached: false,
      cacheSource: 'none',
      functionGradeCacheMeta:
        isFunctionGradeMode && normalizedFunctionRoot
          ? {
              strategyCap: maxStrategiesToRun,
              keywordsHash,
              functionRoot: normalizedFunctionRoot,
              country: normalizedCountry,
            }
          : undefined,
      strategyResults,
    };
  }

  /**
   * Build a full-company org chart JSON object from a list of LinkedIn
   * candidates by mapping them into the "people" format expected by the
   * Python OrgStructure.create_org_charts_json_from_std_people_array
   * pipeline and delegating the heavy lifting to Python.
   */
  async buildOrgChartFromLinkedInCompanyCandidates(
    candidates: OrgChartCandidateInput[],
    options: {
      companyName: string;
      companyId?: string;
      mode?: string;
      function?: string;
    },
  ): Promise<OrgChartData> {
    const { companyName, companyId, mode, function: fn } = options;
    const normalizedCompanyName = (companyName ?? '').trim();
    const normalizedCompanyId =
      (companyId ?? '').trim() ||
      (normalizedCompanyName
        ? normalizedCompanyName.replace(/\s+/g, '').toLowerCase()
        : '');

    const companyLinkedinUrl =
      normalizedCompanyId !== ''
        ? `https://www.linkedin.com/company/${normalizedCompanyId}`
        : '';

    const people: StandardizedOrgChartPerson[] = candidates.map((candidate, index) => {
      const raw = candidate as Record<string, unknown>;

      const fullName =
        (typeof (raw as { fullName?: unknown }).fullName === 'string' &&
          (raw as { fullName: string }).fullName) ||
        (typeof (raw as { name?: unknown }).name === 'string' &&
          (raw as { name: string }).name) ||
        '';

      const rawJob =
        typeof (raw as { jobTitle?: unknown }).jobTitle === 'string'
          ? (raw as { jobTitle: string }).jobTitle?.trim()
          : '';
      const rawHeadline =
        typeof (raw as { headline?: unknown }).headline === 'string'
          ? (raw as { headline: string }).headline?.trim()
          : '';
      const rawJobTitleSnake =
        typeof (raw as { job_title?: unknown }).job_title === 'string'
          ? (raw as { job_title: string }).job_title?.trim()
          : '';
      const rawLinkedInHeadline =
        typeof (raw as { linkedin_headline?: unknown }).linkedin_headline ===
        'string'
          ? (raw as { linkedin_headline: string }).linkedin_headline?.trim()
          : '';
      const jobTitleStr =
        (rawJob && rawJob !== 'N/A' ? rawJob : '') ||
        rawHeadline ||
        rawJobTitleSnake ||
        rawLinkedInHeadline ||
        '';
      const jobTitle =
        typeof jobTitleStr === 'string' ? jobTitleStr : '';

      const jobCompanyName =
        (typeof (raw as { jobCompanyName?: unknown }).jobCompanyName ===
          'string' &&
          (raw as { jobCompanyName: string }).jobCompanyName) ||
        (typeof (raw as { company?: unknown }).company === 'string' &&
          (raw as { company: string }).company) ||
        normalizedCompanyName;

      const locationName =
        (typeof (raw as { locationName?: unknown }).locationName ===
          'string' &&
          (raw as { locationName: string }).locationName) ||
        (typeof (raw as { location?: unknown }).location === 'string' &&
          (raw as { location: string }).location) ||
        '';

      const industry =
        (typeof (raw as { industry?: unknown }).industry === 'string' &&
          (raw as { industry: string }).industry) ||
        '';

      const linkedinUrl =
        (typeof (raw as { linkedinUrl?: unknown }).linkedinUrl === 'string' &&
          (raw as { linkedinUrl: string }).linkedinUrl) ||
        (typeof (raw as { profileUrl?: unknown }).profileUrl === 'string' &&
          (raw as { profileUrl: string }).profileUrl) ||
        '';

      const locationCountry =
        (typeof (raw as { locationCountry?: unknown }).locationCountry ===
          'string' &&
          (raw as { locationCountry: string }).locationCountry) ||
        '';

      const locationRegion =
        (typeof (raw as { locationRegion?: unknown }).locationRegion ===
          'string' &&
          (raw as { locationRegion: string }).locationRegion) ||
        '';

      const locationLocality =
        (typeof (raw as { locationLocality?: unknown }).locationLocality ===
          'string' &&
          (raw as { locationLocality: string }).locationLocality) ||
        '';

      const idValue =
        (typeof (raw as { peopleId?: unknown }).peopleId === 'string' &&
          (raw as { peopleId: string }).peopleId) ||
        (typeof (raw as { id?: unknown }).id === 'string' &&
          (raw as { id: string }).id) ||
        (linkedinUrl !== '' ? linkedinUrl : '') ||
        `${fullName || 'candidate'}-${jobCompanyName || 'company'}-${index}`;

      const profilePictureUrl =
        (typeof (raw as { profile_picture_url?: unknown }).profile_picture_url ===
          'string' &&
          (raw as { profile_picture_url: string }).profile_picture_url) ||
        (typeof (raw as { profile_picture_url_large?: unknown })
          .profile_picture_url_large === 'string' &&
          (raw as { profile_picture_url_large: string })
            .profile_picture_url_large) ||
        (typeof (raw as { profilePictureUrl?: unknown }).profilePictureUrl ===
          'string' &&
          (raw as { profilePictureUrl: string }).profilePictureUrl) ||
        (typeof (raw as { displayPicture?: unknown }).displayPicture ===
          'string' &&
          (raw as { displayPicture: string }).displayPicture) ||
        '';

      return {
        full_name: fullName,
        job_title: jobTitle,
        job_company_linkedin_url: companyLinkedinUrl,
        job_company_id: normalizedCompanyId || jobCompanyName || '',
        job_company_name: jobCompanyName,
        industry,
        country: locationCountry || 'global',
        job_company_website: '',
        linkedin_url: linkedinUrl,
        facebook_url: '',
        twitter_url: '',
        gender: '',
        location_country: locationCountry,
        location_region: locationRegion,
        location_locality: locationLocality,
        location_metro: '',
        location_name: locationName,
        inferred_salary: '',
        inferred_years_experience: '',
        emails: '',
        phone_numbers: '',
        profile_picture_url: profilePictureUrl,
        id: idValue,
      };
    });

    this.logger.log(
      `OrgchartLinkedInSearch: building org chart from ${people.length} candidates for company="${normalizedCompanyName}"`,
    );

    const jobNameSuffix = fn
      ? fn.replace(/\s+/g, '-').toLowerCase()
      : mode === 'leadership'
        ? 'leadership'
        : mode === 'entire_company' || mode === 'all_people'
          ? 'entire'
          : mode ?? 'chart';
    const jobName = `orgchart-${normalizedCompanyName.replace(/\s+/g, '-')}-${jobNameSuffix}`;

    const orgChart =
      await this.pythonOrgChartService.createOrgChartFromStandardizedPeople({
        people,
        jobName,
        jobId: normalizedCompanyId || undefined,
        functionRoot: fn,
      });

    return orgChart;
  }

  async getCachedCompanyOrgChart(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
  }): Promise<CachedCompanyOrgChartPayload | undefined> {
    const cacheKey = this.buildCompanyOrgChartCacheKey(
      input.companyName,
      input.companyId,
      input.mode,
      input.searchType,
    );

    const cached =
      await this.orgChartCacheStorageService.get<CachedCompanyOrgChartPayload>(
        cacheKey,
      );

    if (!cached?.orgChart) {
      this.logger.log(
        `Orgchart cache MISS: key=${cacheKey} (company="${input.companyName ?? input.companyId ?? ''}")`,
      );
      return undefined;
    }

    this.logger.log(
      `Orgchart cache HIT: key=${cacheKey}, itemCount=${cached.itemCount}, cachedAt=${cached.cachedAt}`,
    );

    return cached;
  }

  async getCachedCompanyCandidateList(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
  }): Promise<CachedCompanyCandidateListPayload | undefined> {
    const cacheKey = this.buildCompanyOrgChartCandidateListCacheKey(
      input.companyName,
      input.companyId,
      input.mode,
      input.searchType,
    );

    const cached =
      await this.orgChartCacheStorageService.get<CachedCompanyCandidateListPayload>(
        cacheKey,
      );

    if (!cached?.items || !Array.isArray(cached.items)) {
      this.logger.log(
        `Candidate list cache MISS: key=${cacheKey} (company="${input.companyName ?? input.companyId ?? ''}")`,
      );
      return undefined;
    }

    const cacheAgeMs = this.getCacheAgeMs(cached.cachedAt);
    const isFresh = this.isCompanyCandidateListCacheFresh(cached.cachedAt);

    if (!isFresh) {
      const ageDays =
        typeof cacheAgeMs === 'number'
          ? Math.floor(cacheAgeMs / (1000 * 60 * 60 * 24))
          : 'unknown';
      this.logger.log(
        `Candidate list cache STALE: key=${cacheKey}, ageDays=${ageDays}, cachedAt=${cached.cachedAt}`,
      );
      return undefined;
    }

    this.logger.log(
      `Candidate list cache HIT: key=${cacheKey}, itemCount=${cached.itemCount}, cachedAt=${cached.cachedAt}`,
    );

    return cached;
  }

  async setCachedCompanyOrgChart(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    orgChart: OrgChartData;
    items: any[];
    itemCount: number;
    /** True if credits were debited when creating this org chart. Default true for backward compat. */
    creditsDebited?: boolean;
  }): Promise<void> {
    const normalizedCompanyName = this.normalizeCompanyName(input.companyName);
    const normalizedCompanyId = this.normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const cacheKey = this.buildCompanyOrgChartCacheKey(
      normalizedCompanyName,
      normalizedCompanyId,
      input.mode,
      input.searchType,
    );

    const payload: CachedCompanyOrgChartPayload = {
      companyId: normalizedCompanyId,
      companyName: normalizedCompanyName,
      mode: input.mode,
      searchType: input.searchType,
      orgChart: input.orgChart,
      items: input.items,
      itemCount: input.itemCount,
      cachedAt: new Date().toISOString(),
      creditsDebited: input.creditsDebited ?? true,
    };

    const ttlFromEnv = Number(process.env.ORG_CHART_COMPANY_CACHE_TTL_SECONDS);
    const ttlSeconds =
      Number.isFinite(ttlFromEnv) && ttlFromEnv > 0
        ? Math.floor(ttlFromEnv)
        : DEFAULT_ORG_CHART_COMPANY_CACHE_TTL_SECONDS;

    await this.orgChartCacheStorageService.set(cacheKey, payload, ttlSeconds);
    this.logger.log(
      `Orgchart cache WRITE: key=${cacheKey}, itemCount=${payload.itemCount}, ttlSeconds=${ttlSeconds}, cachedAt=${payload.cachedAt}`,
    );
  }

  shouldCacheCompanyOrgChart(input: {
    orgChart: OrgChartData | undefined;
    fallbackCandidateCount?: number;
    companyName?: string;
    companyId?: string;
  }): boolean {
    const { orgChart, fallbackCandidateCount = 0, companyName, companyId } =
      input;

    if (!orgChart || typeof orgChart !== 'object') {
      this.logger.warn(
        `Orgchart cache SKIP: invalid org chart payload for company="${companyName ?? companyId ?? ''}"`,
      );
      return false;
    }

    const inferredPeopleCount = this.inferPeopleCountFromOrgChart(orgChart);
    const ttlMinFromEnv = Number(process.env.ORG_CHART_MIN_PEOPLE_TO_CACHE);
    const minPeopleToCache =
      Number.isFinite(ttlMinFromEnv) && ttlMinFromEnv > 0
        ? Math.floor(ttlMinFromEnv)
        : DEFAULT_ORG_CHART_MIN_PEOPLE_TO_CACHE;

    const effectivePeopleCount = Math.max(
      inferredPeopleCount,
      fallbackCandidateCount,
    );

    if (effectivePeopleCount < minPeopleToCache) {
      this.logger.warn(
        `Orgchart cache SKIP: sparse org chart for company="${companyName ?? companyId ?? ''}" (inferredPeopleCount=${inferredPeopleCount}, fallbackCandidateCount=${fallbackCandidateCount}, minPeopleToCache=${minPeopleToCache})`,
      );
      return false;
    }

    this.logger.log(
      `Orgchart cache ELIGIBLE: company="${companyName ?? companyId ?? ''}" (inferredPeopleCount=${inferredPeopleCount}, fallbackCandidateCount=${fallbackCandidateCount}, minPeopleToCache=${minPeopleToCache})`,
    );

    return true;
  }

  async setCachedCompanyCandidateList(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    items: any[];
    itemCount: number;
  }): Promise<void> {
    const normalizedCompanyName = this.normalizeCompanyName(input.companyName);
    const normalizedCompanyId = this.normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const cacheKey = this.buildCompanyOrgChartCandidateListCacheKey(
      normalizedCompanyName,
      normalizedCompanyId,
      input.mode,
      input.searchType,
    );

    const payload: CachedCompanyCandidateListPayload = {
      companyId: normalizedCompanyId,
      companyName: normalizedCompanyName,
      mode: input.mode,
      searchType: input.searchType,
      items: input.items,
      itemCount: input.itemCount,
      cachedAt: new Date().toISOString(),
    };

    const ttlFromEnv = Number(
      process.env.ORG_CHART_COMPANY_CANDIDATES_CACHE_TTL_SECONDS,
    );
    const ttlSeconds =
      Number.isFinite(ttlFromEnv) && ttlFromEnv > 0
        ? Math.floor(ttlFromEnv)
        : DEFAULT_ORG_CHART_COMPANY_CANDIDATES_CACHE_TTL_SECONDS;

    await this.orgChartCacheStorageService.set(cacheKey, payload, ttlSeconds);
    this.logger.log(
      `Candidate list cache WRITE: key=${cacheKey}, itemCount=${payload.itemCount}, ttlSeconds=${ttlSeconds}, cachedAt=${payload.cachedAt}`,
    );
  }

  async getCachedFunctionGradeSearch(input: {
    companyName?: string;
    companyId?: string;
    functionRoot: string;
    country: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    strategyCap: number;
    keywordsHash: string;
  }): Promise<CachedFunctionGradeSearchPayload | undefined> {
    const cacheKey = this.buildFunctionGradeCacheKey(input);
    const cached =
      await this.orgChartCacheStorageService.get<CachedFunctionGradeSearchPayload>(
        cacheKey,
      );

    if (!cached?.items || !Array.isArray(cached.items)) {
      this.logger.log(
        `Function-grade cache MISS: key=${cacheKey} (company="${input.companyName ?? input.companyId ?? ''}", functionRoot="${input.functionRoot}", country="${input.country}")`,
      );
      return undefined;
    }

    this.logger.log(
      `Function-grade cache HIT: key=${cacheKey}, itemCount=${cached.itemCount}, cachedAt=${cached.cachedAt}`,
    );
    return cached;
  }

  async setCachedFunctionGradeSearch(input: {
    companyName?: string;
    companyId?: string;
    functionRoot: string;
    country: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    strategyCap: number;
    keywordsHash: string;
    items: any[];
    itemCount: number;
    orgChart?: OrgChartData;
  }): Promise<void> {
    const normalizedCompanyName = this.normalizeCompanyName(input.companyName);
    const normalizedCompanyId = this.normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const normalizedFunctionRoot = this.normalizeFunctionRoot(input.functionRoot);
    const normalizedCountry = this.normalizeCountry(input.country);

    const cacheKey = this.buildFunctionGradeCacheKey({
      companyName: normalizedCompanyName,
      companyId: normalizedCompanyId,
      functionRoot: normalizedFunctionRoot,
      country: normalizedCountry,
      searchType: input.searchType,
      strategyCap: input.strategyCap,
      keywordsHash: input.keywordsHash,
    });

    const payload: CachedFunctionGradeSearchPayload = {
      companyId: normalizedCompanyId,
      companyName: normalizedCompanyName,
      functionRoot: normalizedFunctionRoot,
      country: normalizedCountry,
      searchType: input.searchType,
      strategyCap: input.strategyCap,
      keywordsHash: input.keywordsHash,
      items: input.items,
      itemCount: input.itemCount,
      ...(input.orgChart ? { orgChart: input.orgChart } : {}),
      cachedAt: new Date().toISOString(),
    };

    const ttlFromEnv = Number(
      process.env.ORG_CHART_FUNCTION_GRADE_CACHE_TTL_SECONDS,
    );
    const ttlSeconds =
      Number.isFinite(ttlFromEnv) && ttlFromEnv > 0
        ? Math.floor(ttlFromEnv)
        : DEFAULT_ORG_CHART_FUNCTION_GRADE_CACHE_TTL_SECONDS;

    await this.orgChartCacheStorageService.set(cacheKey, payload, ttlSeconds);
    this.logger.log(
      `Function-grade cache WRITE: key=${cacheKey}, itemCount=${payload.itemCount}, ttlSeconds=${ttlSeconds}, cachedAt=${payload.cachedAt}, hasOrgChart=${!!payload.orgChart}`,
    );
  }

  private buildFunctionGradeCacheKey(input: {
    companyName?: string;
    companyId?: string;
    functionRoot: string;
    country: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    strategyCap: number;
    keywordsHash: string;
  }): string {
    const normalizedCompanyName = this.normalizeCompanyName(input.companyName);
    const normalizedCompanyId = this.normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const normalizedFunctionRoot = this.normalizeFunctionRoot(input.functionRoot);
    const normalizedCountry = this.normalizeCountry(input.country);
    const normalizedKeywordsHash = (input.keywordsHash || '').trim().toLowerCase();
    const strategyCap = Number.isFinite(input.strategyCap) && input.strategyCap > 0
      ? Math.floor(input.strategyCap)
      : 1;

    return [
      ORG_CHART_FUNCTION_GRADE_CACHE_KEY_PREFIX,
      normalizedCompanyId,
      normalizedFunctionRoot || 'unknown_function',
      normalizedCountry || 'global',
      input.searchType,
      `cap_${strategyCap}`,
      normalizedKeywordsHash || 'no_keywords_hash',
    ].join(':');
  }

  private filterOrgChartCandidatesByCountryAndFunctionRoot(
    items: any[],
    countryRaw?: string,
    functionRootRaw?: string,
  ): any[] {
    const normalizedCountryRaw =
      typeof countryRaw === 'string' ? countryRaw.trim() : '';
    const hasCountryFilter =
      normalizedCountryRaw.length > 0 &&
      normalizedCountryRaw.toLowerCase() !== 'global';

    const normalizedFunctionRootRaw =
      typeof functionRootRaw === 'string' ? functionRootRaw.trim() : '';
    const hasFunctionRootFilter =
      hasMeaningfulOrgChartFunctionRootFilter(normalizedFunctionRootRaw);

    if (!hasCountryFilter && !hasFunctionRootFilter) {
      return items;
    }

    return items.filter((item) => {
      const raw = item as Record<string, unknown>;

      if (hasCountryFilter) {
        const filterCountry = normalizedCountryRaw.toLowerCase();
        const possibleCountryValues = [
          (raw as { locationCountry?: unknown }).locationCountry,
          (raw as { location_country?: unknown }).location_country,
          raw.country,
        ].filter(
          (v): v is string =>
            typeof v === 'string' && v.trim().length > 0,
        );

        const normalizedCountry =
          possibleCountryValues[0]?.trim().toLowerCase() ?? '';

        if (!normalizedCountry.includes(filterCountry)) {
          return false;
        }
      }

      if (hasFunctionRootFilter) {
        const filterFunctionRoot = normalizedFunctionRootRaw.toLowerCase();
        const possibleFunctionRootValues = [
          (raw as { std_function_root?: unknown }).std_function_root,
          (raw as { functionRoot?: unknown }).functionRoot,
          (raw as { function_root?: unknown }).function_root,
        ].filter(
          (v): v is string =>
            typeof v === 'string' && v.trim().length > 0,
        );

        const normalizedFunctionRoot =
          possibleFunctionRootValues[0]?.trim().toLowerCase() ?? '';

        if (
          normalizedFunctionRoot === '' ||
          !normalizedFunctionRoot.includes(filterFunctionRoot)
        ) {
          return false;
        }
      }

      return true;
    });
  }

  private buildFunctionGradeKeywordsHash(
    strategies: Array<{
      id?: string;
      label?: string;
      parameters?: Record<string, unknown>;
    }>,
  ): string {
    const normalized = strategies.map((strategy) => {
      const rawKeywords = strategy.parameters?.keywords;
      const rawJobTitle = strategy.parameters?.job_title;
      const keywords =
        typeof rawKeywords === 'string' ? rawKeywords.trim().toLowerCase() : '';
      const jobTitle =
        typeof rawJobTitle === 'string' ? rawJobTitle.trim().toLowerCase() : '';
      return {
        id: strategy.id ?? '',
        label: strategy.label ?? '',
        keywords,
        jobTitle,
      };
    });

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private buildCompanyOrgChartCacheKey(
    companyName: string | undefined,
    companyId: string | undefined,
    mode: 'entire_company',
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const normalizedCompanyName = this.normalizeCompanyName(companyName);
    const normalizedCompanyId = this.normalizeCompanyId(
      companyId,
      normalizedCompanyName,
    );

    return [
      ORG_CHART_COMPANY_CACHE_KEY_PREFIX,
      normalizedCompanyId,
      mode,
      searchType,
    ].join(':');
  }

  private buildCompanyOrgChartCandidateListCacheKey(
    companyName: string | undefined,
    companyId: string | undefined,
    mode: 'entire_company',
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const normalizedCompanyName = this.normalizeCompanyName(companyName);
    const normalizedCompanyId = this.normalizeCompanyId(
      companyId,
      normalizedCompanyName,
    );

    return [
      ORG_CHART_COMPANY_CANDIDATE_LIST_CACHE_KEY_PREFIX,
      normalizedCompanyId,
      mode,
      searchType,
    ].join(':');
  }

  private isCompanyCandidateListCacheFresh(cachedAt: string): boolean {
    const cacheAgeMs = this.getCacheAgeMs(cachedAt);
    if (cacheAgeMs === undefined) {
      return false;
    }

    return cacheAgeMs < THREE_MONTHS_IN_MS;
  }

  private inferPeopleCountFromOrgChart(orgChart: Record<string, unknown>): number {
    const directPeopleCount = this.getPeopleCountFromDirectField(orgChart);
    if (directPeopleCount > 0) {
      return directPeopleCount;
    }

    const orgchartField = (orgChart as { orgchart?: unknown }).orgchart;
    if (typeof orgchartField === 'string') {
      try {
        const parsed = JSON.parse(orgchartField) as unknown;
        return this.countPeopleLikeEntries(parsed);
      } catch {
        return 0;
      }
    }

    if (Array.isArray(orgchartField) || typeof orgchartField === 'object') {
      return this.countPeopleLikeEntries(orgchartField);
    }

    return this.countPeopleLikeEntries(orgChart);
  }

  private getPeopleCountFromDirectField(orgChart: Record<string, unknown>): number {
    const possibleCountFields = [
      'people_count',
      'peopleCount',
      'candidate_count',
      'candidateCount',
      'total_people',
      'totalPeople',
      'itemCount',
    ] as const;

    for (const field of possibleCountFields) {
      const value = (orgChart as Record<string, unknown>)[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
      }
    }

    return 0;
  }

  private countPeopleLikeEntries(value: unknown): number {
    const uniqueNames = new Set<string>();

    const visit = (node: unknown) => {
      if (Array.isArray(node)) {
        node.forEach((child) => visit(child));
        return;
      }

      if (!node || typeof node !== 'object') {
        return;
      }

      const record = node as Record<string, unknown>;
      for (const [key, rawValue] of Object.entries(record)) {
        if (key.startsWith('name_') && typeof rawValue === 'string') {
          const normalizedName = rawValue.trim().toLowerCase();
          if (normalizedName.length > 0) {
            uniqueNames.add(normalizedName);
          }
        } else if (typeof rawValue === 'object') {
          visit(rawValue);
        } else if (Array.isArray(rawValue)) {
          visit(rawValue);
        }
      }
    };

    visit(value);
    return uniqueNames.size;
  }

  private getCacheAgeMs(cachedAt: string): number | undefined {
    const cachedTimestamp = Date.parse(cachedAt);
    if (!Number.isFinite(cachedTimestamp)) {
      return undefined;
    }

    return Date.now() - cachedTimestamp;
  }

  private normalizeCompanyName(companyName?: string): string {
    return (companyName ?? '').trim();
  }

  private normalizeFunctionRoot(functionRoot?: string): string {
    return (functionRoot ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]+/g, '')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeCountry(country?: string): string {
    const normalized = (country ?? '').trim().toLowerCase();
    if (!normalized) {
      return 'global';
    }
    return normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]+/g, '');
  }

  private normalizeCompanyId(companyId?: string, fallbackName?: string): string {
    const normalizedCompanyId = (companyId ?? '').trim().toLowerCase();
    if (normalizedCompanyId) {
      return normalizedCompanyId;
    }

    const normalizedFallbackName = (fallbackName ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalizedFallbackName || 'unknown_company';
  }
}

import {
    forwardRef,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import {
    LinkedInClassicCompaniesSearchRequest,
    LinkedInClassicJobsSearchRequest,
    LinkedInSalesNavigatorCompaniesSearchRequest,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';
import { OrgChartLinkedInBuildService } from 'src/engine/core-modules/org-chart/services/org-chart-linkedin-build.service';
import { type OrgChartLinkedinCandidateSource } from 'src/engine/core-modules/org-chart/types/orgchart-linkedin-candidate-source.type';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { parseFunctionRootOrNull } from '../schemas/org-chart.schema';
import {
    ClassicPeopleSearchStrategyResult,
    GeneratedSearchParameters,
    ParsedJobDescription,
    RecruiterPeopleSearchStrategyResult,
    ResultValidationResult,
    SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import { ChatMessageRequest } from '../types/search-plan.types';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../utils/linkedin-query-generation-mapper.util';
import { mergeFilters } from '../utils/org-chart-filters-merge.util';
import { createMinimalParsedJobDescription } from '../utils/parsed-job-description.util';
import { constructSearchParamKey } from '../utils/search-parameter.utils';
import { buildTitleTaxonomyResolvedIntent } from '../utils/title-taxonomy-resolved-intent.util';
import { TokenUsage } from '../utils/token-tracking.util';
import type { AssistantThreadContext } from './assistant-thread.service';
import { AssistantThreadService } from './assistant-thread.service';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { ClassifyMessageService } from './classify-message.service';
import { CleanupService } from './cleanup.service';
import { JobDescriptionService } from './job-description.service';
import { OrgchartLinkedInQueryRouterService } from './orgchart-linkedin-query-router.service';
import {
    PythonQueryGenerationService,
    type PythonQueryInput,
} from './python-query-generation.service';
import { RequirementAnalyzerService } from './requirement-analyzer.service';
import { SearchExecutionService } from './search-execution.service';
import { SearchIntentRouterService } from './search-intent-router.service';
import { SearchParameterGenerationService } from './search-parameter-generation.service';
import { SearchResponseBuilderService } from './search-response-builder.service';
import { StrategyExecutionService } from './strategy-execution.service';

import { buildIterativeRequirement } from 'src/engine/core-modules/assistant/utils/assistant-iterative-query.utils';
import { OrgChartIntentService } from 'src/engine/core-modules/candidate-search/services/org-chart-intent.service';
export type HandlerMessageStreamSendEvent = (
  event: string,
  data: Record<string, unknown>,
) => boolean | void;

export type HandleMessageStreamResult = {
  response: {
    success?: boolean;
    type?: string;
    data?: unknown;
    chatMessage?: string;
    error?: string;
  };
  assistantMessage: string | null;
};

const DEFAULT_PARSED_JD_MESSAGE_STREAM: ParsedJobDescription =
  createMinimalParsedJobDescription();

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionResult = {
  itemCount: number;
  searchResults?: {
    items?: unknown[];
    paging?: { total_count?: number; page_count?: number };
  } | null;
  transformedCandidates?: unknown[];
  streamTableId?: string;
  validationResults?: Array<{
    page: number;
    validation: ResultValidationResult;
    timestamp: string;
  }>;
  overallValidation?: ResultValidationResult;
  error?: { message: string; code?: string; details?: string };
};

@Injectable()
export class CandidateSearchHandlerService {
  private readonly logger = new Logger(CandidateSearchHandlerService.name);

  constructor(
    private readonly assistantThreadService: AssistantThreadService,
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly jobDescriptionService: JobDescriptionService,
    private readonly searchParameterGenerationService: SearchParameterGenerationService,
    private readonly requirementAnalyzerService: RequirementAnalyzerService,
    private readonly searchIntentRouterService: SearchIntentRouterService,
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly classifyMessageService: ClassifyMessageService,
    private readonly cleanupService: CleanupService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly searchResponseBuilderService: SearchResponseBuilderService,
    private readonly strategyExecutionService: StrategyExecutionService,
    private readonly orgchartLinkedInQueryRouterService: OrgchartLinkedInQueryRouterService,
    private readonly orgChartIntentService: OrgChartIntentService,
    @Inject(forwardRef(() => OrgChartLinkedInBuildService))
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
  ) {}

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      const error = new Error('Request aborted');
      error.name = 'AbortError';
      throw error;
    }
  }

  /**
   * Validation/scoring need the recruiter's natural-language requirement, including
   * iterative steering (POST .../iterative-query). Assistant search passes LinkedIn
   * keywords as body.message; prefer effectiveRequirement (base + steering), then thread
   * strategy, then chat.
   */
  private resolveRecruiterRequirementForValidationScoring(
    thread: AssistantThreadContext,
    fallbackSearchText: string,
  ): string {
    const ap = thread.assistantParameters;
    const iterativeState =
      ap?.iterativeQueryState && typeof ap.iterativeQueryState === 'object'
        ? (ap.iterativeQueryState as Record<string, unknown>)
        : undefined;

    const effectiveFromIterative =
      typeof iterativeState?.effectiveRequirement === 'string'
        ? iterativeState.effectiveRequirement.trim()
        : '';
    if (effectiveFromIterative) {
      return effectiveFromIterative;
    }

    const baseFromIterative =
      typeof iterativeState?.baseRequirement === 'string'
        ? iterativeState.baseRequirement.trim()
        : '';
    const steeringFromIterative = Array.isArray(iterativeState?.steeringHistory)
      ? (iterativeState.steeringHistory as Array<Record<string, unknown>>)
      : [];
    if (baseFromIterative && steeringFromIterative.length > 0) {
      return buildIterativeRequirement(baseFromIterative, steeringFromIterative);
    }
    if (baseFromIterative) {
      return baseFromIterative;
    }

    const strategy = thread.assistantSearchStrategy;
    if (strategy && typeof strategy === 'object') {
      const s = strategy as Record<string, unknown>;
      const effectiveFromStrategy =
        typeof s.effectiveRequirement === 'string'
          ? s.effectiveRequirement.trim()
          : '';
      if (effectiveFromStrategy) {
        return effectiveFromStrategy;
      }
      const baseFromStrategy =
        typeof s.baseRequirement === 'string' ? s.baseRequirement.trim() : '';
      const steeringFromStrategy = Array.isArray(s.steeringHistory)
        ? (s.steeringHistory as Array<Record<string, unknown>>)
        : [];
      if (baseFromStrategy && steeringFromStrategy.length > 0) {
        return buildIterativeRequirement(baseFromStrategy, steeringFromStrategy);
      }
      if (baseFromStrategy) {
        return baseFromStrategy;
      }
    }

    const userMsgs =
      thread.messages?.filter(
        (m) =>
          m.role === 'user' &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0 &&
          !m.content.startsWith('Steer query set:'),
      ) ?? [];
    const lastUser = userMsgs[userMsgs.length - 1];
    const fromChat = lastUser?.content?.trim() ?? '';
    if (fromChat) {
      return fromChat;
    }

    return fallbackSearchText;
  }

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
    abortSignal?: AbortSignal,
    messageStreamOptions?: Pick<
      ChatMessageRequest,
      | 'linkedinQueryGenerator'
      | 'candidateSource'
      | 'linkedinCompanyUrl'
      | 'orgchartCompanyName'
      | 'orgchartCompanyId'
      | 'xraySearchEngine'
      | 'apifyMaxItems'
    >,
  ) {
    const { tokenAccumulator, accumulateTokens } =
      this.createTokenAccumulator();
    const model = 'gpt-5.1-chat-latest';

    try {
      this.throwIfAborted(abortSignal);
      sendEvent?.('status', { message: 'Analyzing query requirements...' });

      this.validateSearchParametersInput(parsedJD, searchType, searchCategory);
      const context = await this.prepareSearchContext(
        assistantThreadId,
        searchType,
        searchCategory,
        apiToken,
        userMessage,
      );
      this.throwIfAborted(abortSignal);
      this.logger.log(
        `Generated context:: ${JSON.stringify(context, null, 2)}`,
      );

      let preUnresolved: GeneratedSearchParameters | undefined;

      if (searchCategory !== 'people') {
        throw new HttpException(
          'Only people search is supported; use the multi-agent flow.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const gen =
        messageStreamOptions?.linkedinQueryGenerator === 'multi_agent'
          ? 'multi_agent'
          : 'python';

      this.logger.log(
        `Message stream unresolved generator: ${gen}, candidateSource=${messageStreamOptions?.candidateSource ?? 'unipile'}`,
      );

      if (gen === 'python') {
        sendEvent?.('message', {
          type: 'linkedin_query_generation_path',
          path: 'python',
        });
        preUnresolved = await this.generateUnresolvedSearchParams(
          rawQuery,
          cleanedQuery,
          searchType,
          searchCategory,
          apiToken,
          userMessage,
          parsedJD,
          context.jobId,
          sendEvent,
          includeJd,
          accumulateTokens,
          { queryGenerator: 'python' },
        );
      } else {
        sendEvent?.('message', {
          type: 'linkedin_query_generation_path',
          path: 'multi_agent',
        });
        preUnresolved =
          await this.generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
            cleanedQuery || rawQuery,
            searchType,
            sendEvent,
          );
      }
      this.throwIfAborted(abortSignal);
      this.logger.log(
        `Pre-unresolved search parameters:: ${JSON.stringify(preUnresolved, null, 2)}`,
      );
      if (!preUnresolved || Object.keys(preUnresolved).length === 0) {
        throw new HttpException(
          'LinkedIn query generation did not produce search parameters',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const source: OrgChartLinkedinCandidateSource =
        messageStreamOptions?.candidateSource ?? 'unipile';

      let searchResult: {
        unresolvedSearchParams: GeneratedSearchParameters;
        resolvedParams: GeneratedSearchParameters;
        strategyResults: Array<{
          strategy: PeopleSearchStrategyResult;
          result: SearchExecutionResult | null;
        }>;
      };

      if (source === 'apify' || source === 'linkedin_xray') {
        searchResult = await this.runAlternateCandidateSourceMessageStreamSearch({
          preUnresolved,
          rawQuery,
          cleanedQuery,
          searchType,
          candidateSource: source,
          apiToken,
          messageStreamOptions,
          sendEvent,
          context,
        });
      } else {
        searchResult = await this.generateAndExecuteSearchParameters(
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
      }
      this.throwIfAborted(abortSignal);

      return this.searchResponseBuilderService.buildAndSendResponse(
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

  /**
   * Apify / LinkedIn x-ray: reuse org-chart LinkedIn build (entire_company) after
   * unresolved params are produced so the chat stream can surface the same items shape.
   */
  private async runAlternateCandidateSourceMessageStreamSearch(args: {
    preUnresolved: GeneratedSearchParameters;
    rawQuery: string;
    cleanedQuery: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    candidateSource: Extract<
      OrgChartLinkedinCandidateSource,
      'apify' | 'linkedin_xray'
    >;
    apiToken: string;
    messageStreamOptions?: Pick<
      ChatMessageRequest,
      | 'linkedinQueryGenerator'
      | 'linkedinCompanyUrl'
      | 'orgchartCompanyName'
      | 'orgchartCompanyId'
      | 'xraySearchEngine'
      | 'apifyMaxItems'
    >;
    sendEvent?: (event: string, data: any) => void;
    context: {
      accountId: string;
      searchParamKey: string;
      searchFilter: AssistantThreadContext;
      jobId?: string;
    };
  }): Promise<{
    unresolvedSearchParams: GeneratedSearchParameters;
    resolvedParams: GeneratedSearchParameters;
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>;
  }> {
    const linkedinUrl = args.messageStreamOptions?.linkedinCompanyUrl?.trim();
    if (!linkedinUrl) {
      throw new HttpException(
        'linkedinCompanyUrl is required on the chat request when candidateSource is apify or linkedin_xray',
        HttpStatus.BAD_REQUEST,
      );
    }

    const companyName =
      args.messageStreamOptions?.orgchartCompanyName?.trim() ||
      args.messageStreamOptions?.orgchartCompanyId?.trim() ||
      'Company';

    const requestId = `cstream-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const effectiveSearchType: 'classic' | 'sales_navigator' | 'recruiter' =
      args.candidateSource === 'apify' ? 'classic' : args.searchType;

    const orgChartBody = {
      rawQuery: args.cleanedQuery || args.rawQuery,
      cleanedQuery: args.cleanedQuery || args.rawQuery,
      companyName,
      companyId: args.messageStreamOptions?.orgchartCompanyId,
      jobTitles: [] as string[],
      mode: 'entire_company' as const,
      searchType: effectiveSearchType,
      requestId,
      linkedinCompanyUrl: linkedinUrl,
      candidateSource: args.candidateSource,
      queryGenerator:
        args.messageStreamOptions?.linkedinQueryGenerator === 'python'
          ? ('python' as const)
          : ('multi_agent' as const),
      apifyMaxItems: args.messageStreamOptions?.apifyMaxItems,
      xraySearchEngine: args.messageStreamOptions?.xraySearchEngine,
    };

    args.sendEvent?.('status', {
      message: `Fetching candidates via ${args.candidateSource} (org-chart pipeline)...`,
    });

    const json = (await this.orgChartLinkedInBuildService.searchOrgchartFromLinkedIn(
      orgChartBody,
      {
        Authorization: `Bearer ${args.apiToken}`,
        'Content-Type': 'application/json',
      },
    )) as Record<string, unknown>;

    const queued = json.queued === true;
    if (queued) {
      args.sendEvent?.('message', {
        type: 'alternate_candidate_source_queued',
        candidateSource: args.candidateSource,
        requestId: json.requestId,
        data: json,
      });
    }

    const items = Array.isArray(json.items)
      ? (json.items as Record<string, unknown>[])
      : [];

    const extracted = this.strategyExecutionService.extractStrategiesFromGeneratedParams(
      args.preUnresolved,
      args.searchType,
      'people',
    );
    const primaryStrategy: PeopleSearchStrategyResult =
      extracted[0] ??
      ({
        id: 'candidate-stream-alt',
        label: `${args.candidateSource} search`,
        parameters: {},
      } as ClassicPeopleSearchStrategyResult);

    const itemCount =
      typeof json.itemCount === 'number' ? json.itemCount : items.length;

    const resultPayload: SearchExecutionResult = queued
      ? {
          itemCount: 0,
          transformedCandidates: [],
        }
      : {
          itemCount,
          transformedCandidates: items as unknown[],
          searchResults: {
            items,
            paging: undefined,
          },
        };

    await this.updateAssistantThreadWithParameters(
      args.context.searchFilter,
      args.context.searchParamKey,
      args.preUnresolved,
      {},
      args.apiToken,
      args.sendEvent,
    );

    return {
      unresolvedSearchParams: args.preUnresolved,
      resolvedParams: {},
      strategyResults: [
        {
          strategy: primaryStrategy,
          result: resultPayload,
        },
      ],
    };
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
        tokenAccumulator.cachedTokens =
          (tokenAccumulator.cachedTokens || 0) + (usage.cachedTokens || 0);
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
    this.logger.log(
      `Generating search parameters from LinkedIn query generation...`,
    );
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
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
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

    this.logger.log(
      `[Strategy] Generated unresolved search parameters:: ${JSON.stringify(unresolvedSearchParams, null, 2)}`,
    );
    this.logger.log(
      `[Strategy] Resolved parameters:: ${JSON.stringify(resolvedParams, null, 2)}`,
    );

    const strategies =
      this.strategyExecutionService.extractStrategiesFromGeneratedParams(
        unresolvedSearchParams,
        searchType,
        searchCategory,
      );

    this.logger.log(
      `Strategies extracted: ${strategies.length} strategies found`,
    );

    const strategyResults =
      await this.strategyExecutionService.executeStrategySearches(
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

    return {
      unresolvedSearchParams,
      resolvedParams,
      strategyResults,
    };
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
    this.logger.error(
      'Error generating search parameters in handle search error:',
      error,
    );

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
    const accountId =
      await this.candidateSearchBaseService.getLinkedInAccountId(apiToken);
    const searchParamKey = constructSearchParamKey(searchType, searchCategory);
    const searchFilter =
      await this.assistantThreadService.getAssistantThreadContext(
        assistantThreadId,
        apiToken,
      );
    const jobId = searchFilter?.jobId;

    this.logger.log(
      `assistantThread context:: ${JSON.stringify(searchFilter, null, 2)}`,
    );
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
    this.logger.log(
      `[Strategy: ${strategyId}] Generating and resolving search parameters for ${searchParamKey}`,
    );

    const unresolvedSearchParams =
      preUnresolved ??
      (await this.generateUnresolvedSearchParams(
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
        undefined,
      ));
    if (!preUnresolved) {
      sendEvent?.('status', { message: 'Connecting to AI model...' });
    }

    if (!unresolvedSearchParams) {
      throw new HttpException(
        'Failed to generate search parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(
      `[Strategy: ${strategyId}] searchParamKey:: ${searchParamKey}`,
    );
    // Extract search parameters
    const searchParams = unresolvedSearchParams[searchParamKey];

    let resolvedParams = {};

    if (!searchParams) {
      this.logger.warn(
        `[Strategy: ${strategyId}] No search parameters generated for ${searchParamKey}, using empty object`,
      );
    } else {
      sendEvent?.('status', { message: 'Resolving parameter IDs...' });
      this.logger.log(
        `[Strategy: ${strategyId}] Resolving parameter IDs for search parameters`,
      );
      let resolvedSearchParameters: GeneratedSearchParameters = {};
      if (process.env.SEARCH_TESTING_MODE === 'true') {
        resolvedSearchParameters = {
          // [searchParamKey]: searchParams[searchParamKey],
        };
      } else {
        resolvedSearchParameters =
          await this.linkedinParameterResolver.resolveParameterIds(
            searchParams,
            accountId,
            strategyId,
          );
      }
      // Store resolved params under the searchParamKey for consistency
      resolvedParams = {
        [searchParamKey]:
          resolvedSearchParameters[searchParamKey] || resolvedSearchParameters,
      };
      this.logger.log(
        `[Strategy: ${strategyId}] Completed resolving search parameters`,
      );
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
    await this.assistantThreadService.updateAssistantThreadParameters(
      threadContext.id,
      updatedAssistantParameters,
      threadContext.messages,
      apiToken,
    );
  }

  async getAssistantThreadContext(
    assistantThreadId: string,
    apiToken: string,
  ): Promise<AssistantThreadContext> {
    return this.assistantThreadService.getAssistantThreadContext(
      assistantThreadId,
      apiToken,
    );
  }

  async addChatMessage(
    assistantThreadId: string,
    role: 'user' | 'assistant',
    content: string,
    apiToken: string,
  ): Promise<void> {
    return this.assistantThreadService.addChatMessage(
      assistantThreadId,
      role,
      content,
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
    abortSignal?: AbortSignal,
  ): Promise<HandleMessageStreamResult> {
    this.throwIfAborted(abortSignal);
    const parsedJD: ParsedJobDescription =
      body.parsedJD &&
      typeof body.parsedJD === 'object' &&
      !Array.isArray(body.parsedJD)
        ? ({
            ...DEFAULT_PARSED_JD_MESSAGE_STREAM,
            ...body.parsedJD,
          } as ParsedJobDescription)
        : DEFAULT_PARSED_JD_MESSAGE_STREAM;

    const thread = await this.assistantThreadService.getAssistantThreadContext(
      body.assistantThreadId,
      apiToken,
    );
    this.throwIfAborted(abortSignal);
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

    const messageClassification =
      await this.classifyMessageService.classifyMessage(
        body.message,
        apiToken,
        chatHistory as Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp?: string;
        }>,
        rawJDText,
      );
    this.throwIfAborted(abortSignal);

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
        const pendingClarification =
          thread.assistantParameters?.pendingClarification;
        const clarificationQuestions = pendingClarification?.questions ?? [];
        const previousUserMessages = chatHistory.filter(
          (msg: { role: string }) => msg.role === 'user',
        );
        const originalQuery =
          previousUserMessages.length > 1
            ? previousUserMessages[previousUserMessages.length - 2]?.content
            : (previousUserMessages[previousUserMessages.length - 1]?.content ??
              body.message);
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
          abortSignal,
          {
            linkedinQueryGenerator: body.linkedinQueryGenerator,
            candidateSource: body.candidateSource,
            linkedinCompanyUrl: body.linkedinCompanyUrl,
            orgchartCompanyName: body.orgchartCompanyName,
            orgchartCompanyId: body.orgchartCompanyId,
            xraySearchEngine: body.xraySearchEngine,
            apifyMaxItems: body.apifyMaxItems,
          },
        );
        if (response?.chatMessage) assistantMessage = response.chatMessage;
        break;
      }
      case 'search_parameters': {
        const cleanedQuery = await this.cleanupService.cleanupQuery(
          body.message,
          apiToken,
        );
        const threadForRequirement =
          await this.assistantThreadService.getAssistantThreadContext(
            body.assistantThreadId,
            apiToken,
          );
        const requirementForScoring =
          this.resolveRecruiterRequirementForValidationScoring(
            threadForRequirement,
            body.message,
          );
        response = await this.handleSearchParametersAndResultsGenerationStream(
          body.message,
          cleanedQuery,
          body.assistantThreadId,
          parsedJD,
          body.searchType ?? 'classic',
          body.searchCategory ?? 'people',
          apiToken,
          requirementForScoring,
          sendEvent as (event: string, data: unknown) => void,
          body.includeJd !== false,
          false,
          abortSignal,
          {
            linkedinQueryGenerator: body.linkedinQueryGenerator,
            candidateSource: body.candidateSource,
            linkedinCompanyUrl: body.linkedinCompanyUrl,
            orgchartCompanyName: body.orgchartCompanyName,
            orgchartCompanyId: body.orgchartCompanyId,
            xraySearchEngine: body.xraySearchEngine,
            apifyMaxItems: body.apifyMaxItems,
          },
        );
        if (response?.chatMessage) assistantMessage = response.chatMessage;
        break;
      }
      case 'general_help':
        assistantMessage =
          "I can help you with candidate search and recruitment workflows! Here's what I can do:\n\n" +
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
    const data = response?.data as
      | {
          strategyResults?: Array<{
            preview?: { transformedCandidates?: unknown[] };
          }>;
        }
      | undefined;
    const strategyResults = data?.strategyResults;
    if (!Array.isArray(strategyResults)) return [];

    const rows: Record<string, unknown>[] = [];
    for (const sr of strategyResults) {
      const candidates = sr.preview?.transformedCandidates;
      if (Array.isArray(candidates)) {
        for (const c of candidates) {
          rows.push(
            typeof c === 'object' && c !== null
              ? (c as Record<string, unknown>)
              : { value: c },
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
    await this.assistantThreadService.updateAssistantThreadParameters(
      assistantThreadId,
      updatedAssistantParameters,
      messages,
      apiToken,
    );
  }

  private async storeClarificationContext(
    assistantThreadId: string,
    questions: string[],
    apiToken: string,
  ): Promise<void> {
    return this.assistantThreadService.storeClarificationContext(
      assistantThreadId,
      questions,
      apiToken,
    );
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
    orgChartGenerateOptions?: {
      orgChartContext?: {
        mode?: string;
        companyName?: string;
        jobTitles?: string[];
        country?: string;
        functionRoot?: string;
        businessDivisionRawQuery?: string;
        businessDivisionLinkedinKeywords?: string;
      };
      queryGenerator?: 'python' | 'multi_agent';
      /** When org chart data comes from Apify or x-ray, only classic people facets apply. */
      candidateSource?: OrgChartLinkedinCandidateSource;
    },
  ): Promise<GeneratedSearchParameters> {
    try {
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken),
        );
      const generatedParameters: GeneratedSearchParameters = {};
      this.logger.log(
        `Generating search parameters for search type: ${searchType}, search category: ${searchCategory}`,
      );
      if (userMessage) this.logger.log(`User message: ${userMessage}`);

      const rawJDText =
        includeJd && jobId
          ? await this.jobDescriptionService.getJDContentFromJobAttachments(
              jobId,
              apiToken,
            )
          : '';

      if (rawJDText && includeJd) {
        this.logger.log(
          `Fetched raw JD text, length: ${rawJDText.length} characters`,
        );
      } else if (!includeJd) {
        this.logger.log(`JD content excluded from prompts (includeJd=false)`);
      }

      const isStreamAborted = sendEvent?.('status', {
        message: `Generating ${searchType} ${searchCategory} search parameters...`,
      });
      if (isStreamAborted === false) {
        this.logger.log('Stream aborted, stopping parameter generation');
        return generatedParameters;
      }

      // Handle people search: org-chart context (Python / multi-agent router) or multi-agent requirement flow
      if (searchCategory === 'people' && orgChartGenerateOptions?.orgChartContext) {
        sendEvent?.('status', {
          message: 'Generating people search parameters (org-chart router)...',
        });
        const ctx = orgChartGenerateOptions.orgChartContext;
        const rawCandidateSource = orgChartGenerateOptions.candidateSource;
        const candidateSource: OrgChartLinkedinCandidateSource =
          rawCandidateSource === 'apify' || rawCandidateSource === 'linkedin_xray'
            ? rawCandidateSource
            : 'unipile';
        const effectiveSearchType: 'classic' | 'sales_navigator' | 'recruiter' =
          candidateSource === 'apify' || candidateSource === 'linkedin_xray'
            ? 'classic'
            : searchType;
        if (effectiveSearchType !== searchType) {
          this.logger.log(
            `Org-chart unresolved params: candidateSource=${candidateSource} uses classic-shaped filters; coercing searchType from ${searchType} to ${effectiveSearchType}.`,
          );
        }
        const primaryCompanyName = ctx.companyName?.trim() ?? '';
        let country = ctx.country?.trim() ?? '';
        if (country.toLowerCase() === 'global') {
          country = '';
        }
        let functionRoot = ctx.functionRoot?.trim() ?? '';
        let businessDivisionLinkedinKeywords =
          ctx.businessDivisionLinkedinKeywords?.trim();
        const businessDivisionRaw = ctx.businessDivisionRawQuery?.trim();
        let titleTaxonomyResolvedIntent: Record<string, unknown> | undefined;
        if (businessDivisionRaw && primaryCompanyName) {
          if (!businessDivisionLinkedinKeywords) {
            const workspaceId =
              await this.workspaceQueryService.getWorkspaceIdFromToken(
                apiToken,
              );
            const { openAIclient: openaiClient } =
              await this.workspaceQueryService.initializeLLMClients(workspaceId);
            const parsed =
              await this.orgChartIntentService.resolveBusinessDivision(
                openaiClient,
                {
                  companyName: primaryCompanyName,
                  userRawText: businessDivisionRaw,
                  defaultCountry: ctx.country ?? '',
                  defaultFunctionRoot: ctx.functionRoot ?? '',
                },
                sendEvent,
              );
            const merged = mergeFilters(
              parsed,
              ctx.country ?? '',
              ctx.functionRoot ?? '',
            );
            if (!merged.businessDivisionKeywords) {
              throw new Error(
                'Business division intent did not produce business_division_keywords',
              );
            }
            businessDivisionLinkedinKeywords = merged.businessDivisionKeywords;
            country =
              merged.effectiveCountryRaw === '' ||
              merged.effectiveCountryRaw.toLowerCase() === 'global'
                ? ''
                : merged.effectiveCountryRaw;
            functionRoot = merged.effectiveFunctionRoot;
            titleTaxonomyResolvedIntent = buildTitleTaxonomyResolvedIntent({
                companyName: primaryCompanyName,
                parsed,
                effectiveFunctionRoot: merged.effectiveFunctionRoot,
              });
          } else {
            titleTaxonomyResolvedIntent = buildTitleTaxonomyResolvedIntent({
              companyName: primaryCompanyName,
              parsed: {
                business_division_keywords: businessDivisionLinkedinKeywords,
                country: ctx.country ?? null,
                business_division: null,
                role_description: null,
                std_grade_levels: null,
                function_root: parseFunctionRootOrNull(functionRoot),
                rationale: null,
              },
              effectiveFunctionRoot: functionRoot,
            });
          }
          if (businessDivisionLinkedinKeywords) {
            businessDivisionLinkedinKeywords =
              await this.orgchartLinkedInQueryRouterService.enrichBusinessDivisionLinkedinKeywords(
                {
                  queryGenerator: orgChartGenerateOptions?.queryGenerator,
                  businessDivisionRaw,
                  primaryCompanyName,
                  baseBusinessDivisionKeywords: businessDivisionLinkedinKeywords,
                  requirementForMultiAgent: cleanedQuery || rawQuery,
                  titleTaxonomyResolvedIntent,
                  sendEvent,
                },
              );
          }
        }
        const hasAdditionalFilters =
          !!country || hasMeaningfulOrgChartFunctionRootFilter(functionRoot);
        const isAllPeopleInCompanyMode =
          effectiveSearchType === 'classic' &&
          !!primaryCompanyName &&
          ctx.mode === 'entire_company' &&
          !hasAdditionalFilters &&
          !businessDivisionRaw;

        return this.orgchartLinkedInQueryRouterService.buildGeneratedSearchParametersForOrgchart(
          {
            rawQuery,
            cleanedQuery,
            requirement: cleanedQuery || rawQuery,
            searchType: effectiveSearchType,
            mode: ctx.mode,
            primaryCompanyName,
            jobTitles: ctx.jobTitles,
            country,
            functionRoot,
            businessDivisionLinkedinKeywords,
            isAllPeopleInCompanyMode,
            apiToken,
            queryGenerator: orgChartGenerateOptions.queryGenerator,
            sendEvent,
          },
        );
      }

      if (
        searchCategory === 'people' &&
        orgChartGenerateOptions?.queryGenerator === 'python'
      ) {
        sendEvent?.('status', {
          message: 'Routing search intent...',
        });
        const route = await this.searchIntentRouterService.routeIntent(
          rawQuery,
          cleanedQuery,
          openaiClient,
          onTokenUsage,
          sendEvent,
        );

        const employerName = route.primary_employer_name?.trim();
        if (route.intent === 'employer_scoped' && employerName) {
          this.logger.log(
            `Search intent: employer_scoped → org-chart pipeline for "${employerName}"`,
          );
          sendEvent?.('status', {
            message:
              'Employer-scoped query — building search via org-chart pipeline...',
          });
          return this.generateUnresolvedSearchParams(
            rawQuery,
            cleanedQuery,
            searchType,
            searchCategory,
            apiToken,
            userMessage,
            parsedJobDescription,
            jobId,
            sendEvent,
            includeJd,
            onTokenUsage,
            {
              ...orgChartGenerateOptions,
              orgChartContext: {
                mode: 'entire_company',
                companyName: employerName,
                businessDivisionRawQuery: cleanedQuery || rawQuery,
                country: '',
                functionRoot: '',
                jobTitles: [],
              },
              queryGenerator: orgChartGenerateOptions?.queryGenerator ?? 'python',
              candidateSource: orgChartGenerateOptions?.candidateSource,
            },
          );
        }

        if (route.intent === 'employer_scoped' && !employerName) {
          this.logger.warn(
            'Search intent router returned employer_scoped without primary_employer_name; falling back to open-market Python path.',
          );
        }

        sendEvent?.('status', {
          message:
            'Generating people search parameters (Python query generator)...',
        });
        const parsed = await this.requirementAnalyzerService.analyzeRequirement(
          rawQuery,
          cleanedQuery,
          openaiClient,
          onTokenUsage,
          sendEvent,
        );
        const pythonInput: PythonQueryInput = {
          company_names: [],
        };
        const role = parsed.primary_role_name?.trim();
        if (role) {
          pythonInput.raw_job_titles = [role];
        }
        return this.pythonQueryGenerationService.generateSearchParameters(
          pythonInput,
          searchType,
          cleanedQuery || rawQuery,
        );
      }

      if (searchCategory === 'people') {
        sendEvent?.('status', {
          message: 'Generating people search parameters...',
        });
        const multiAgentResult =
          await this.generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
            rawQuery,
            searchType,
            sendEvent,
          );
        const strategies =
          multiAgentResult.classicPeopleSearchStrategies ??
          multiAgentResult.salesNavigatorPeopleSearchStrategies ??
          multiAgentResult.recruiterPeopleSearchStrategies ??
          [];
        Object.assign(generatedParameters, multiAgentResult);
        if (strategies.length > 0) {
          if (searchType === 'classic') {
            generatedParameters.classicPeopleSearch = (
              strategies[0] as ClassicPeopleSearchStrategyResult
            ).parameters;
          } else if (searchType === 'sales_navigator') {
            generatedParameters.salesNavigatorPeopleSearch = (
              strategies[0] as SalesNavigatorPeopleSearchStrategyResult
            ).parameters;
          } else {
            generatedParameters.recruiterPeopleSearch = (
              strategies[0] as RecruiterPeopleSearchStrategyResult
            ).parameters;
          }
        }
        return generatedParameters;
      }

      if (
        searchCategory === 'companies' &&
        (searchType === 'classic' || searchType === 'sales_navigator')
      ) {
        const companiesSearchParams =
          await this.searchParameterGenerationService.streamCompaniesSearchParameters(
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
          generatedParameters.classicCompaniesSearch =
            companiesSearchParams as Omit<
              LinkedInClassicCompaniesSearchRequest,
              'api' | 'category'
            >;
        } else {
          generatedParameters.salesNavigatorCompaniesSearch =
            companiesSearchParams as Omit<
              LinkedInSalesNavigatorCompaniesSearchRequest,
              'api' | 'category'
            >;
        }
        return generatedParameters;
      }

      // Handle jobs search (only classic)
      if (searchCategory === 'jobs' && searchType === 'classic') {
        const jobsSearchParams =
          await this.searchParameterGenerationService.streamJobsSearchParameters(
            openaiClient,
            userMessage,
            parsedJobDescription,
            rawJDText,
            sendEvent,
            includeJd,
          );
        generatedParameters.classicJobsSearch = jobsSearchParams as Omit<
          LinkedInClassicJobsSearchRequest,
          'api' | 'category'
        >;
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(
        `Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`,
      );
      throw error;
    }
  }
}

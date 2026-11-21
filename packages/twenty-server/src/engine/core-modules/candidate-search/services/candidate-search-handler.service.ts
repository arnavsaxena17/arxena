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
import type { LinkedinXraySearchEngine } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { parseFunctionRootOrNull } from '../schemas/org-chart.schema';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../utils/linkedin-query-generation-mapper.util';
import { mergeFilters } from '../utils/org-chart-filters-merge.util';
import { constructSearchParamKey } from '../utils/search-parameter.utils';
import { buildTitleTaxonomyResolvedIntent } from '../utils/title-taxonomy-resolved-intent.util';
import { TokenUsage } from '../utils/token-tracking.util';
import { CandidateSearchBaseService } from './candidate-search-base.service';
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

import { OrgChartIntentService } from 'src/engine/core-modules/candidate-search/services/org-chart-intent.service';

const buildIterativeRequirement = (
  baseRequirement: string,
  steeringHistory: Array<Record<string, unknown>>,
): string =>
  [
    `Base requirement: ${baseRequirement}`,
    steeringHistory.length > 0
      ? `User steering updates:\n${steeringHistory
          .map((entry, index) => `${index + 1}. ${String(entry.message ?? '')}`)
          .join('\n')}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');

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

// Source and generator switches for a LinkedIn people search.
type SearchStreamOptions = {
  linkedinQueryGenerator?: 'python' | 'multi_agent';
  candidateSource?: OrgChartLinkedinCandidateSource;
  linkedinCompanyUrl?: string;
  orgchartCompanyName?: string;
  orgchartCompanyId?: string;
  xraySearchEngine?: LinkedinXraySearchEngine;
  apifyMaxItems?: number;
};
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

  async handleSearchParametersAndResultsGenerationStream(
    rawQuery: string,
    cleanedQuery: string,
    projectId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
    apiToken: string,
    userMessage: string,
    sendEvent?: (event: string, data: any) => void,
    includeJd: boolean = true,
    isClarificationResponse: boolean = false,
    abortSignal?: AbortSignal,
    messageStreamOptions?: SearchStreamOptions,
  ) {
    const { tokenAccumulator, accumulateTokens } =
      this.createTokenAccumulator();
    const model = 'gpt-6-luna';

    try {
      this.throwIfAborted(abortSignal);
      sendEvent?.('status', { message: 'Analyzing query requirements...' });

      this.validateSearchParametersInput(parsedJD, searchType, searchCategory);
      const context = await this.prepareSearchContext(
        projectId,
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
          context.projectId,
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
        searchResult =
          await this.runAlternateCandidateSourceMessageStreamSearch({
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
    messageStreamOptions?: SearchStreamOptions;
    sendEvent?: (event: string, data: any) => void;
    context: {
      accountId: string;
      searchParamKey: string;
      projectId?: string;
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

    const json =
      (await this.orgChartLinkedInBuildService.searchOrgchartFromLinkedIn(
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

    const extracted =
      this.strategyExecutionService.extractStrategiesFromGeneratedParams(
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
      projectId?: string;
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
        context.projectId,
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
    projectId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
  ): Promise<{
    accountId: string;
    searchParamKey: string;
    projectId: string;
  }> {
    const accountId =
      await this.candidateSearchBaseService.getLinkedInAccountId(apiToken);
    const searchParamKey = constructSearchParamKey(searchType, searchCategory);

    this.logger.log(
      `Generating search parameters for ${searchType} ${searchCategory}`,
    );
    this.logger.log(`ProjectId: ${projectId}`);

    if (userMessage) {
      this.logger.log(`User message: ${userMessage}`);
    }

    return { accountId, searchParamKey, projectId };
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
    projectId?: string,
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
        projectId,
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

  async generateUnresolvedSearchParams(
    rawQuery: string,
    cleanedQuery: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
    apiToken: string,
    userMessage: string,
    parsedJobDescription?: ParsedJobDescription,
    projectId?: string,
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
        includeJd && projectId
          ? await this.jobDescriptionService.getJDContentFromJobAttachments(
              projectId,
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
      if (
        searchCategory === 'people' &&
        orgChartGenerateOptions?.orgChartContext
      ) {
        sendEvent?.('status', {
          message: 'Generating people search parameters (org-chart router)...',
        });
        const ctx = orgChartGenerateOptions.orgChartContext;
        const rawCandidateSource = orgChartGenerateOptions.candidateSource;
        const candidateSource: OrgChartLinkedinCandidateSource =
          rawCandidateSource === 'apify' ||
          rawCandidateSource === 'linkedin_xray'
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
              await this.workspaceQueryService.initializeLLMClients(
                workspaceId,
              );
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
                  baseBusinessDivisionKeywords:
                    businessDivisionLinkedinKeywords,
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
            projectId,
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
              queryGenerator:
                orgChartGenerateOptions?.queryGenerator ?? 'python',
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

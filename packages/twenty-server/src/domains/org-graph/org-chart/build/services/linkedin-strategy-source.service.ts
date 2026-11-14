import { type FetchedPage } from 'src/domains/ingestion/candidate-sourcing/run/round.util';
import { Injectable } from '@nestjs/common';
import {
  randomOrgChartLinkedInPageDelayMs,
  sleepMs,
} from 'src/domains/org-graph/org-chart/utils/orgchart-linkedin-scope.util';
import {
  getLinkedInUnipileEstimateProbePageLimit,
  getLinkedInUnipileSearchPageLimit,
} from 'twenty-shared';
import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
import { LinkedinParameterCatalogService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-parameter-catalog.service';
import { ParameterSanitizer } from 'src/domains/discovery/query/utils/parameter-sanitizer.util';
import type { CandidateTableRow } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { LinkedinParameterResolver } from 'src/domains/discovery/transport/linkedin-search/utils/linkedin-parameter-resolver.util';
import { LinkedInRecruiterPeopleTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-recruiter-people-transformer.service';
import { LinkedInSearchService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-search.service';
import {
  LinkedInSearchConfig,
  LinkedInSearchResponse,
  LinkedInSearchResult,
} from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-response.type';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from 'src/domains/discovery/query/types/candidate-search-request.type';
import { LinkedinSearchExecutionBase } from 'src/domains/discovery/query/services/linkedin-search-execution.base';
// import { QuerySimplificationService } from './query-simplification.service';
export type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

export type SearchExecutionOptions = {
  forceClassicPeopleJson?: boolean;
  linkedInAccountId?: string;
  /** How linkedInAccountId was resolved (from LinkedinUnipileSessionService). */
  linkedInAccountIdSource?: string;
  /** When true, sleep between page fetches (default 2–3s unless pageDelayMs set). */
  throttlePages?: boolean;
  /** Override inter-page delay (e.g. unlimited mode 30–120s). */
  pageDelayMs?: () => number;
  /** Also sleep before the first page request when throttlePages is true. */
  throttleBeforeFirstPage?: boolean;
  /** Stop collecting once this many unique candidates are gathered. */
  maxCandidates?: number;
  /** Resolved from withLinkedinSession when parent already holds a session. */
  inferredSearchType?: 'classic' | 'sales_navigator' | 'recruiter';
};

// A search result with the table row made from it, kept together so the two
// lists cannot drift apart while paging
export type StrategyRow = {
  item: LinkedInSearchResult;
  transformed: CandidateTableRow | undefined;
};

export type PreparedStrategySearch = {
  resolvedParams: GeneratedSearchParameters;
  forceClassicPeopleJson: boolean;
  usesRawClassicPeople: boolean;
};

export const strategyRowKey = ({ item }: StrategyRow): string =>
  (item as { public_identifier?: string }).public_identifier ??
  item.id ??
  (item as { name?: string }).name ??
  '';

export const transformedOf = (rows: StrategyRow[]): CandidateTableRow[] =>
  rows.flatMap((row) =>
    row.transformed === undefined ? [] : [row.transformed],
  );

// LinkedIn as a source, through a connected account: it resolves a strategy's
// parameters and fetches one page of it. It never decides how many pages to
// fetch or when to stop; the fetch round does.
@Injectable()
export class LinkedInStrategySource extends LinkedinSearchExecutionBase {
  constructor(
    linkedInSearchService: LinkedInSearchService,
    linkedinParameterResolver: LinkedinParameterResolver,
    private readonly linkedinRecruiterPeopleTransformer: LinkedInRecruiterPeopleTransformerService,
    linkedinUnipileSessionService: LinkedinUnipileSessionService,
    parameterSanitizer: ParameterSanitizer,
    linkedinParameterCatalog: LinkedinParameterCatalogService,
  ) {
    super(
      linkedInSearchService,
      linkedinParameterResolver,
      linkedinUnipileSessionService,
      parameterSanitizer,
      linkedinParameterCatalog,
    );
  }


  withSession<T>(
    apiToken: string,
    executionOptions: SearchExecutionOptions | undefined,
    run: (nextOptions: SearchExecutionOptions | undefined) => Promise<T>,
  ): Promise<T> {
    const explicitAccountId = executionOptions?.linkedInAccountId?.trim();
    if (explicitAccountId) {
      return run({
        ...executionOptions,
        linkedInAccountId: explicitAccountId,
      });
    }

    return this.linkedinUnipileSessionService.withLinkedinSession(
      apiToken,
      executionOptions?.linkedInAccountId,
      async (session) =>
        run({
          ...executionOptions,
          linkedInAccountId: session.accountId,
          linkedInAccountIdSource: session.accountIdSource,
          inferredSearchType: session.inferredSearchType,
        }),
    );
  }

  /**
   * Fetches page 1 for a strategy and returns LinkedIn paging metadata (for org-chart estimates).
   */
  async probe(
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    executionOptions?: SearchExecutionOptions,
  ): Promise<{ totalCount: number; pageCount: number } | null> {
    if (!strategy.parameters) {
      return null;
    }
    return this.withSession(
      apiToken,
      executionOptions,
      async (sessionExecutionOptions) => {
        const pageLimit = getLinkedInUnipileEstimateProbePageLimit();
        let strategyResolvedParams: GeneratedSearchParameters = {
          [parameterKey]: strategy.parameters,
        } as GeneratedSearchParameters;

        const areParamsResolved = this.checkIfParametersResolved(
          strategyResolvedParams,
          searchType,
          searchCategory,
        );
        if (!areParamsResolved) {
          const accountId = await this.getLinkedInAccountId(
            apiToken,
            sessionExecutionOptions?.linkedInAccountId,
          );
          strategyResolvedParams = await this.resolveSearchParameters(
            strategyResolvedParams,
            searchType,
            searchCategory,
            accountId,
          );
        }

        const pageResult = await this.fetchRawPage(
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          undefined,
          pageLimit,
          undefined,
          1,
          sessionExecutionOptions?.forceClassicPeopleJson === true,
          sessionExecutionOptions?.linkedInAccountId,
          sessionExecutionOptions?.linkedInAccountIdSource,
        );

        if (!pageResult?.paging?.total_count) {
          return {
            totalCount: pageResult?.items.length ?? 0,
            pageCount: pageResult?.items.length ?? 0,
          };
        }

        return {
          totalCount: pageResult.paging.total_count,
          pageCount: pageResult.items.length,
        };
      },
    );
  }

  // What both searches need before the first page: parameters resolved to
  // LinkedIn ids, and which paging the endpoint uses
  async prepare(
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    executionOptions: SearchExecutionOptions | undefined,
  ): Promise<PreparedStrategySearch | null> {
    if (!strategy.parameters) {
      this.logger.warn(
        `Strategy ${strategy.id} has no parameters, skipping search`,
      );

      return null;
    }

    let resolvedParams: GeneratedSearchParameters = {
      [parameterKey]: strategy.parameters,
    } as GeneratedSearchParameters;

    // Org-chart flows often provide company names; a classic people search
    // only applies facets such as currentCompany and geoUrn as resolved ids
    if (
      !this.checkIfParametersResolved(
        resolvedParams,
        searchType,
        searchCategory,
      )
    ) {
      const accountId = await this.getLinkedInAccountId(
        apiToken,
        executionOptions?.linkedInAccountId,
      );

      resolvedParams = await this.resolveSearchParameters(
        resolvedParams,
        searchType,
        searchCategory,
        accountId,
      );
    }

    const forceClassicPeopleJson =
      executionOptions?.forceClassicPeopleJson === true;

    if (forceClassicPeopleJson) {
      this.logger.log(
        'forceClassicPeopleJson: classic people search uses Unipile JSON API only (no raw HTML; env LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT ignored).',
      );
    }

    const rawParamObject = ((resolvedParams as Record<string, unknown>)[
      parameterKey
    ] ?? resolvedParams) as { useRawEndpoint?: boolean } | undefined;
    const envRaw = process.env.LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT;

    return {
      resolvedParams,
      forceClassicPeopleJson,
      // The raw HTML endpoint pages by offset and only knows the count of the
      // current page: no cursor to follow, no total to trust
      usesRawClassicPeople:
        !forceClassicPeopleJson &&
        searchType === 'classic' &&
        searchCategory === 'people' &&
        (rawParamObject?.useRawEndpoint === true ||
          envRaw === 'true' ||
          envRaw === '1'),
    };
  }

  // One page of a strategy, in the shape the fetch round pages over
  async fetchPage(
    prepared: PreparedStrategySearch,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    pageLimit: number,
    request: { page: number; cursor: string | undefined },
    sendEvent: ((event: string, data: any) => boolean | void) | undefined,
    executionOptions: SearchExecutionOptions | undefined,
    onFirstPageConfig: (config: LinkedInSearchConfig) => void,
  ): Promise<FetchedPage<StrategyRow> | null> {
    const pageResult = await this.fetchRawPage(
      prepared.resolvedParams,
      searchType,
      searchCategory,
      apiToken,
      request.cursor,
      pageLimit,
      sendEvent,
      request.page,
      prepared.forceClassicPeopleJson,
      executionOptions?.linkedInAccountId,
      executionOptions?.linkedInAccountIdSource,
    );

    if (!pageResult) {
      return null;
    }

    if (request.page === 1 && pageResult.config) {
      onFirstPageConfig(pageResult.config);
    }

    const cursor = pageResult.cursor ?? undefined;

    return {
      items: pageResult.items.map((item, index) => ({
        item,
        transformed: pageResult.transformed[index],
      })),
      ...(!prepared.usesRawClassicPeople &&
        pageResult.paging?.total_count !== undefined && {
          counts: pageResult.paging.total_count,
        }),
      hasMore: prepared.usesRawClassicPeople || cursor !== undefined,
      ...(cursor !== undefined && { cursor }),
    };
  }

  private async fetchRawPage(
    strategyResolvedParams: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    cursor: string | undefined,
    pageLimit: number,
    sendEvent?: (event: string, data: any) => boolean | void,
    currentPage: number = 1,
    forceClassicPeopleJson: boolean = false,
    linkedInAccountIdOverride?: string,
    linkedInAccountIdSource?: string,
  ): Promise<{
    items: LinkedInSearchResult[];
    transformed: CandidateTableRow[];
    cursor?: string | null;
    config?: LinkedInSearchConfig;
    paging?: { total_count: number };
  } | null> {
    sendEvent?.('status', {
      message: `Please wait.. Sending request for page ${currentPage}...`,
      page: currentPage,
    });

    const accountId = await this.getLinkedInAccountId(
      apiToken,
      linkedInAccountIdOverride,
    );

    // For raw classic people search, paginate with start offset (no cursor).
    // Must align with LinkedinSearchExecutionBase.shouldUseRawEndpointForClassicPeople so that
    // when the base service uses the raw endpoint (params or env), we pass start for page 2+.
    const rawFromParams =
      strategyResolvedParams.classicPeopleSearch?.useRawEndpoint ??
      (strategyResolvedParams as { useRawEndpoint?: boolean }).useRawEndpoint;
    const rawFromEnv = (() => {
      const envRaw = process.env.LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT;
      return (
        envRaw !== undefined &&
        envRaw !== '' &&
        (envRaw === 'true' || envRaw === '1')
      );
    })();
    const useRawClassicPeople =
      !forceClassicPeopleJson &&
      searchType === 'classic' &&
      searchCategory === 'people' &&
      (rawFromParams === true || rawFromEnv);
    const start =
      useRawClassicPeople && currentPage > 1
        ? (currentPage - 1) * pageLimit
        : undefined;

    this.logger.log(
      `Fetching page ${currentPage}${start !== undefined ? ` (start=${start})` : ''}`,
    );
    const sourceSuffix = linkedInAccountIdSource
      ? ` source=${linkedInAccountIdSource}`
      : linkedInAccountIdOverride
        ? ' (caller-provided, source unknown)'
        : '';
    this.logger.log(`LinkedIn Unipile accountId=${accountId}${sourceSuffix}`);

    const searchResults = await this.executeLinkedInSearch(
      strategyResolvedParams,
      searchType,
      searchCategory,
      accountId,
      { cursor, limit: pageLimit, start, forceClassicPeopleJson },
    );

    if (!searchResults) {
      this.logger.log('No search results returned');
      return null;
    }
    this.logger.log(
      `Search results items length: ${searchResults.items?.length ?? 0}`,
    );

    let transformedCandidates: CandidateTableRow[] = [];
    if (searchResults.items && searchCategory === 'people') {
      const transformer =
        searchType === 'recruiter'
          ? this.linkedinRecruiterPeopleTransformer
          : this.linkedinSearchResultTransformer;

      transformedCandidates = transformer.transformSearchResultsToTableFormat(
        searchResults.items,
        'linkedin_search_job',
        `${searchType} ${searchCategory} search results`,
      );

      transformedCandidates = transformer.addMetadataToCandidates(
        transformedCandidates,
        {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime: 0,
        },
      );
    }

    return {
      items: searchResults.items || [],
      transformed: transformedCandidates,
      cursor: searchResults.cursor ?? undefined,
      config: searchResults.config,
      paging: searchResults.paging,
    };
  }
}

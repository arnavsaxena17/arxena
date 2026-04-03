import { Injectable } from '@nestjs/common';
import { CandidateRelevanceScoring } from 'src/engine/core-modules/candidate-search/schemas/candidate-relevance-scoring.schema';
import { WorkspaceMemberProfileUnipileService } from '../../arx-chat/services/workspace-member-profile-unipile.service';
import { LinkedInRecruiterPeopleTransformerService } from '../../candidate-sourcing/services/data-sources/linkedin-recruiter-people-transformer.service';
import { LinkedInSearchTransformerService, TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReadParseUploadService } from '../../candidate-sourcing/services/resume-read-parse-upload.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import {
  LinkedInSearchConfig,
  LinkedInSearchResponse,
  LinkedInSearchResult
} from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult
} from '../types/candidate-search-request.type';
import {
  FileUtils,
  LinkedinParameterResolver,
  ParameterSanitizer
} from '../utils';
import { CandidateScoringService } from './candidate-scoring.service';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { JobDescriptionService } from './job-description.service';
// import { QuerySimplificationService } from './query-simplification.service';
import { ResultValidationService } from './result-validation.service';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionPreview = {
  itemCount: number;
  searchResults: LinkedInSearchResponse | null;
  transformedCandidates?: TransformedCandidateForTable[];
  /** When set, final assistant `table_data` should reuse this id so rows are not duplicated in the UI */
  streamTableId?: string;
  searchMetadata?: {
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    timestamp: string;
    processingTime: number;
  };
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
export class SearchExecutionService extends CandidateSearchBaseService {

  constructor(
    linkedInSearchService: LinkedInSearchService,
    workspaceQueryService: WorkspaceQueryService,
    workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    linkedinParameterResolver: LinkedinParameterResolver,
    parameterSanitizer: ParameterSanitizer,
    fileUtils: FileUtils,
    linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    private readonly linkedinRecruiterPeopleTransformer: LinkedInRecruiterPeopleTransformerService,
    staticGraphQLService: StaticGraphQLService,
    resumeReadParseUploadService: ResumeReadParseUploadService,
    jobDescriptionService: JobDescriptionService,
    // querySimplificationService: QuerySimplificationService,
    private readonly resultValidationService: ResultValidationService,
    private readonly candidateScoringService: CandidateScoringService,
  ) {
    super(
      linkedInSearchService,
      workspaceQueryService,
      workspaceMemberProfileUnipileService,
      linkedinParameterResolver,
      parameterSanitizer,
      fileUtils,
      linkedinSearchResultTransformer,
      staticGraphQLService,
      resumeReadParseUploadService,
      jobDescriptionService,
      // querySimplificationService,
    );
  }

  /**
   * Executes a multi-page search strategy without validation or scoring
   * Returns raw search results with pagination info
   */
  async executeMultiPageSearchWithoutValidation(
    parsedJobDescription: ParsedJobDescription,
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    maxPages?: number,
    sendEvent?: (event: string, data: any) => boolean | void,
    executionOptions?: {
      forceClassicPeopleJson?: boolean;
      linkedInAccountId?: string;
    },
  ): Promise<SearchExecutionPreview | null> {
    const pageLimit = 10;
    const maxPagesToFetch =
      typeof maxPages === 'number' && maxPages > 0
        ? maxPages
        : Number.MAX_SAFE_INTEGER;

    try {
      if (!strategy.parameters) {
        this.logger.warn(`Strategy ${strategy.id} has no parameters, skipping search`);
        return null;
      }

      let strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      // Ensure classic/company/location/etc params are resolved to LinkedIn IDs before execution.
      // Orgchart flows (especially python query generation) often provide company names; classic people search
      // requires resolved IDs for facets like currentCompany/geoUrn to be applied.
      const areParamsResolved = this.checkIfParametersResolved(
        strategyResolvedParams,
        searchType,
        searchCategory,
      );
      if (!areParamsResolved) {
        const accountId = await this.getLinkedInAccountId(
          apiToken,
          executionOptions?.linkedInAccountId,
        );
        strategyResolvedParams = await this.resolveSearchParameters(
          strategyResolvedParams,
          searchType,
          searchCategory,
          accountId,
        );
      }

      // Detect raw classic people search so we can rely on offset-based
      // pagination (start param) instead of cursor-based pagination.
      const rawParamObject = (strategyResolvedParams[
        parameterKey
      ] ?? strategyResolvedParams) as { useRawEndpoint?: boolean } | undefined;
      const rawFromParams = rawParamObject?.useRawEndpoint;
      const rawFromEnv = (() => {
        const envRaw = process.env.LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT;
        return (
          envRaw !== undefined &&
          envRaw !== '' &&
          (envRaw === 'true' || envRaw === '1')
        );
      })();
      const forceClassicPeopleJson =
        executionOptions?.forceClassicPeopleJson === true;
      if (forceClassicPeopleJson) {
        this.logger.log(
          'forceClassicPeopleJson: classic people search uses Unipile JSON API only (no raw HTML; env LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT ignored).',
        );
      }
      const useRawClassicPeople =
        !forceClassicPeopleJson &&
        searchType === 'classic' &&
        searchCategory === 'people' &&
        (rawFromParams === true || rawFromEnv);

      const state = {
        allItems: [] as LinkedInSearchResult[],
        allTransformedCandidates: [] as TransformedCandidateForTable[],
        currentCursor: undefined as string | undefined,
        currentPage: 1,
        firstPageConfig: { params: {} } as LinkedInSearchConfig,
        totalCountFromAPI: undefined as number | undefined,
        totalPagesAvailable: undefined as number | undefined,
      };

      this.logger.log(
        `Executing multi-page search (without validation/scoring) for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );

      // Main pagination loop
      while (state.currentPage <= maxPagesToFetch) {
        if (this.shouldAbort(sendEvent)) {
          this.logger.log('Stream aborted, stopping multi-page search');
          break;
        }

        sendEvent?.('status', {
          message: `Fetching page ${state.currentPage}${state.allItems.length > 0 ? ` (${state.allItems.length} candidates collected so far)` : ''}...`,
          page: state.currentPage,
          candidatesCollectedSoFar: state.allItems.length,
        });

        const pageResult = await this.fetchPage(
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          state.currentCursor,
          pageLimit,
          sendEvent,
          state.currentPage,
          forceClassicPeopleJson,
          executionOptions?.linkedInAccountId,
        );

        if (!pageResult || pageResult.items.length === 0) {
          break;
        }

        // Store first page config and pagination info.
        // For raw classic people searches, we intentionally ignore paging.total_count because
        // the raw HTML endpoint only knows the count for the current page, not the full result set.
        // Rely on empty/duplicate pages to stop pagination instead.
        if (state.currentPage === 1 && pageResult.config) {
          state.firstPageConfig = pageResult.config;
          if (!useRawClassicPeople && pageResult.paging?.total_count !== undefined) {
            state.totalCountFromAPI = pageResult.paging.total_count;
            state.totalPagesAvailable = Math.ceil(
              pageResult.paging.total_count / pageLimit,
            );

            this.logger.log(
              `Strategy ${strategy.id} pagination info: Total results available: ${state.totalCountFromAPI}, Total pages: ${state.totalPagesAvailable}, Page limit: ${pageLimit}`,
            );

            sendEvent?.('paginationInfo', {
              strategyId: strategy.id,
              strategyLabel: strategy.label,
              totalCount: state.totalCountFromAPI,
              totalPages: state.totalPagesAvailable,
              pageLimit,
            });
          }
        }

        // Accumulate results (dedupe by id/public_identifier)
        const seenKeysNoVal = new Set(
          state.allItems.map((i) =>
            (i as { public_identifier?: string }).public_identifier ?? i.id ?? (i as { name?: string }).name ?? '',
          ),
        );
        const newItemsNoVal: LinkedInSearchResult[] = [];
        const newTransformedNoVal: TransformedCandidateForTable[] = [];
        pageResult.items.forEach((item, idx) => {
          const key =
            (item as { public_identifier?: string }).public_identifier ??
            item.id ??
            (item as { name?: string }).name ??
            '';
          if (seenKeysNoVal.has(key)) return;
          seenKeysNoVal.add(key);
          newItemsNoVal.push(item);
          if (pageResult.transformed[idx]) newTransformedNoVal.push(pageResult.transformed[idx]);
        });
        state.allItems.push(...newItemsNoVal);
        state.allTransformedCandidates.push(...newTransformedNoVal);
        state.currentCursor = pageResult.cursor ?? undefined;

        this.logger.log(
          `Strategy ${strategy.id} page ${state.currentPage}: ${pageResult.items.length} candidates (total: ${state.allItems.length})`,
        );

        sendEvent?.('pageResults', {
          page: state.currentPage,
          candidatesReceived: pageResult.items.length,
          totalCandidates: state.allItems.length,
          totalCountFromAPI: state.totalCountFromAPI ?? pageResult.paging?.total_count,
          totalPages: state.totalPagesAvailable,
          strategyId: strategy.id,
          strategyLabel: strategy.label,
          remainingToFetch:
            state.totalCountFromAPI != null
              ? Math.max(0, state.totalCountFromAPI - state.allItems.length)
              : undefined,
        });

        // Stop if page returned only duplicates (same results as before - API may not support pagination or has no more)
        if (newItemsNoVal.length === 0 && state.allItems.length > 0) {
          this.logger.log(
            `Stopping pagination for strategy ${strategy.id}: page ${state.currentPage} returned only duplicate results (0 new unique candidates). Likely no more results or pagination not supported.`,
          );
          break;
        }

        // Respect known total pages from API paging metadata.
        if (
          state.totalPagesAvailable !== undefined &&
          state.currentPage >= state.totalPagesAvailable
        ) {
          this.logger.log(
            `Stopping pagination for strategy ${strategy.id}: reached last available page (${state.currentPage}/${state.totalPagesAvailable}).`,
          );
          break;
        }

        // Break if no more pages for cursor-based pagination.
        // For raw classic people search, pagination is start/offset-based and
        // we rely on empty pages / duplicate detection to stop.
        if (!useRawClassicPeople && !state.currentCursor) {
          break;
        }

        state.currentPage++;
      }

      // Log final strategy results (state.currentPage = number of pages we actually ran)
      this.logger.log(
        `Strategy ${strategy.id} (${strategy.label || 'unnamed'}) completed: ` +
        `${state.allItems.length} candidates fetched across ${state.currentPage} pages. ` +
        `Total available: ${state.totalCountFromAPI ?? 'unknown'}, ` +
        `Total pages available: ${state.totalPagesAvailable ?? 'unknown'}`,
      );

      return this.buildResponse(
        state.allItems,
        state.allTransformedCandidates,
        state.firstPageConfig,
        state.currentCursor,
        state.currentPage,
        state.totalCountFromAPI,
        state.totalPagesAvailable,
        [], // No validation results
        undefined, // No overall validation
        searchType,
        searchCategory,
        strategy.id,
      );
    } catch (error) {
      return this.handleError(error, strategy);
    }
  }

  /**
   * Executes a multi-page search strategy, fetching and processing candidates across multiple pages
   */
  async executeMultiPageStrategySearch(
    parsedJobDescription: ParsedJobDescription,
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    userMessage: string | undefined,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<SearchExecutionPreview | null> {
    const pageLimit = 10;
    let stateForPartialCatch: {
      allItems: LinkedInSearchResult[];
      allTransformedCandidates: TransformedCandidateForTable[];
      currentCursor: string | undefined;
      currentPage: number;
      firstPageConfig: LinkedInSearchConfig;
      validationResults: Array<{
        page: number;
        validation: ResultValidationResult;
        timestamp: string;
      }>;
      candidateScores: Map<string, CandidateRelevanceScoring>;
      totalCountFromAPI: number | undefined;
      totalPagesAvailable: number | undefined;
      streamTableId?: string;
    } | null = null;

    try {
      if (!strategy.parameters) {
        this.logger.warn(`Strategy ${strategy.id} has no parameters, skipping search`);
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      // Detect raw classic people search so we can ignore paging.total_count metadata.
      // The raw HTML endpoint only returns the count for the current page, so treating it
      // as the full total would prematurely stop pagination after page 1.
      const rawParamObject = (strategyResolvedParams[
        parameterKey
      ] ?? strategyResolvedParams) as { useRawEndpoint?: boolean } | undefined;
      const rawFromParams = rawParamObject?.useRawEndpoint;
      const rawFromEnv = (() => {
        const envRaw = process.env.LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT;
        return (
          envRaw !== undefined &&
          envRaw !== '' &&
          (envRaw === 'true' || envRaw === '1')
        );
      })();
      const useRawClassicPeople =
        searchType === 'classic' &&
        searchCategory === 'people' &&
        (rawFromParams === true || rawFromEnv);

      const maxPagesToFetch = 10; // Cap to top 10 pages to limit pagination and align with org-chart requirements
      const streamTableId =
        sendEvent && searchCategory === 'people' ? crypto.randomUUID() : undefined;
      const state = {
        allItems: [] as LinkedInSearchResult[],
        allTransformedCandidates: [] as TransformedCandidateForTable[],
        currentCursor: undefined as string | undefined,
        currentPage: 1,
        firstPageConfig: { params: {} } as LinkedInSearchConfig,
        validationResults: [] as Array<{
          page: number;
          validation: ResultValidationResult;
          timestamp: string;
        }>,
        candidateScores: new Map<string, CandidateRelevanceScoring>(),
        totalCountFromAPI: undefined as number | undefined,
        totalPagesAvailable: undefined as number | undefined,
        streamTableId,
      };
      stateForPartialCatch = state;

      let paginationFetchError:
        | { message: string; code?: string; details?: string }
        | undefined;

      this.logger.log(
        `Executing multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );

      // Main pagination loop
      while (state.currentPage <= maxPagesToFetch) {
        if (this.shouldAbort(sendEvent)) {
          this.logger.log('Stream aborted, stopping multi-page search');
          break;
        }

        sendEvent?.('status', {
          message: `Fetching page ${state.currentPage}${state.allItems.length > 0 ? ` (${state.allItems.length} candidates collected so far)` : ''}...`,
          page: state.currentPage,
          candidatesCollectedSoFar: state.allItems.length,
        });

        let pageResult: {
          items: LinkedInSearchResult[];
          transformed: TransformedCandidateForTable[];
          cursor?: string | null;
          config?: LinkedInSearchConfig;
          paging?: { total_count: number };
        } | null;
        try {
          pageResult = await this.fetchPage(
            strategyResolvedParams,
            searchType,
            searchCategory,
            apiToken,
            state.currentCursor,
            pageLimit,
            sendEvent,
            state.currentPage,
          );
        } catch (fetchErr) {
          const errorMessage =
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          const errorCode =
            fetchErr instanceof Error && 'code' in fetchErr
              ? String((fetchErr as { code?: string }).code)
              : undefined;
          this.logger.error(
            `Fetch failed for strategy ${strategy.id} at page ${state.currentPage}:`,
            fetchErr,
          );
          paginationFetchError = {
            message: errorMessage,
            ...(errorCode ? { code: errorCode } : {}),
            details:
              state.allItems.length > 0
                ? `Stopped after page ${state.currentPage - 1}. ${errorMessage}`
                : errorMessage,
          };
          sendEvent?.('status', {
            message:
              state.allItems.length > 0
                ? `Could not load page ${state.currentPage}; returning ${state.allItems.length} candidate${state.allItems.length !== 1 ? 's' : ''} from earlier pages.`
                : `Search request failed: ${errorMessage}`,
          });
          break;
        }

        if (!pageResult || pageResult.items.length === 0) {
          break;
        }

        const page = pageResult;

        // Store first page config and pagination info.
        // For raw classic people searches, ignore paging.total_count for the same reason as above:
        // it only represents the current page, not the total result set.
        if (state.currentPage === 1 && page.config) {
          state.firstPageConfig = page.config;
          if (!useRawClassicPeople && page.paging?.total_count !== undefined) {
            state.totalCountFromAPI = page.paging.total_count;
            state.totalPagesAvailable = Math.ceil(
              page.paging.total_count / pageLimit,
            );

            this.logger.log(
              `Strategy ${strategy.id} pagination info: Total results available: ${state.totalCountFromAPI}, Total pages: ${state.totalPagesAvailable}, Page limit: ${pageLimit}`,
            );

            sendEvent?.('paginationInfo', {
              strategyId: strategy.id,
              strategyLabel: strategy.label,
              totalCount: state.totalCountFromAPI,
              totalPages: state.totalPagesAvailable,
              pageLimit,
            });
          }
        }

        // Accumulate results (dedupe by id/public_identifier)
        const seenKeys = new Set(
          state.allItems.map((i) =>
            (i as { public_identifier?: string }).public_identifier ?? i.id ?? (i as { name?: string }).name ?? '',
          ),
        );
        const newItems: LinkedInSearchResult[] = [];
        const newTransformed: TransformedCandidateForTable[] = [];
        page.items.forEach((item, idx) => {
          const key =
            (item as { public_identifier?: string }).public_identifier ??
            item.id ??
            (item as { name?: string }).name ??
            '';
          if (seenKeys.has(key)) return;
          seenKeys.add(key);
          newItems.push(item);
          if (page.transformed[idx]) newTransformed.push(page.transformed[idx]);
        });
        state.allItems.push(...newItems);
        state.allTransformedCandidates.push(...newTransformed);
        state.currentCursor = page.cursor ?? undefined;

        this.logger.log(
          `Strategy ${strategy.id} page ${state.currentPage}: ${page.items.length} candidates (total: ${state.allItems.length})`,
        );

        if (newItems.length > 0) {
          this.emitProgressiveCandidateTable(
            sendEvent,
            state.streamTableId,
            state.allTransformedCandidates,
            state.candidateScores,
          );
        }

        sendEvent?.('pageResults', {
          page: state.currentPage,
          candidatesReceived: page.items.length,
          totalCandidates: state.allItems.length,
          totalCountFromAPI: state.totalCountFromAPI ?? page.paging?.total_count,
          totalPages: state.totalPagesAvailable,
          strategyId: strategy.id,
          strategyLabel: strategy.label,
          remainingToFetch:
            state.totalCountFromAPI != null
              ? Math.max(0, state.totalCountFromAPI - state.allItems.length)
              : undefined,
        });

        // Stop if page returned only duplicates (same results as before - API may return same page or has no more)
        if (newItems.length === 0 && state.allItems.length > 0) {
          this.logger.log(
            `Stopping pagination for strategy ${strategy.id}: page ${state.currentPage} returned only duplicate results (0 new unique candidates). Likely no more results or pagination not supported.`,
          );
          break;
        }

        // Process page if validation/scoring is enabled
        if (userMessage) {
          const shouldContinue = await this.processPageResults(
            page.items,
            page.transformed,
            state.currentPage,
            state.allItems.length,
            strategy,
            searchCategory,
            searchType,
            parsedJobDescription,
            userMessage,
            apiToken,
            state.candidateScores,
            state.validationResults,
            state.allTransformedCandidates,
            state.streamTableId,
            sendEvent,
          );

          if (!shouldContinue) {
            break;
          }
        } else if (!state.currentCursor) {
          break;
        }

        // Respect known total pages from API paging metadata.
        if (
          state.totalPagesAvailable !== undefined &&
          state.currentPage >= state.totalPagesAvailable
        ) {
          this.logger.log(
            `Stopping pagination for strategy ${strategy.id}: reached last available page (${state.currentPage}/${state.totalPagesAvailable}).`,
          );
          break;
        }

        state.currentPage++;
      }

      // Final processing
      this.attachScoresToAllCandidates(state.allTransformedCandidates, state.allItems, state.candidateScores);
      // Skip separate overall validation: we already validate per page
      // for pagination decisions, and candidates are individually scored.
      const overallValidation = undefined;

      this.sendFinalBatch(state.allTransformedCandidates, state.candidateScores, strategy, sendEvent);

      // Log final strategy results (state.currentPage = number of pages we actually ran)
      this.logger.log(
        `Strategy ${strategy.id} (${strategy.label || 'unnamed'}) completed: ` +
        `${state.allItems.length} candidates fetched across ${state.currentPage} pages. ` +
        `Total available: ${state.totalCountFromAPI ?? 'unknown'}, ` +
        `Total pages available: ${state.totalPagesAvailable ?? 'unknown'}`,
      );

      const preview = this.buildResponse(
        state.allItems,
        state.allTransformedCandidates,
        state.firstPageConfig,
        state.currentCursor,
        state.currentPage,
        state.totalCountFromAPI,
        state.totalPagesAvailable,
        state.validationResults,
        overallValidation,
        searchType,
        searchCategory,
        strategy.id,
        state.streamTableId,
      );
      if (paginationFetchError) {
        return {
          ...preview,
          error: paginationFetchError,
        };
      }
      return preview;
    } catch (error) {
      if (stateForPartialCatch && stateForPartialCatch.allItems.length > 0) {
        this.attachScoresToAllCandidates(
          stateForPartialCatch.allTransformedCandidates,
          stateForPartialCatch.allItems,
          stateForPartialCatch.candidateScores,
        );
        this.sendFinalBatch(
          stateForPartialCatch.allTransformedCandidates,
          stateForPartialCatch.candidateScores,
          strategy,
          sendEvent,
        );
        this.emitProgressiveCandidateTable(
          sendEvent,
          stateForPartialCatch.streamTableId,
          stateForPartialCatch.allTransformedCandidates,
          stateForPartialCatch.candidateScores,
        );
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode =
          error instanceof Error && 'code' in error
            ? String((error as { code?: string }).code)
            : undefined;
        return {
          ...this.buildResponse(
            stateForPartialCatch.allItems,
            stateForPartialCatch.allTransformedCandidates,
            stateForPartialCatch.firstPageConfig,
            stateForPartialCatch.currentCursor,
            stateForPartialCatch.currentPage,
            stateForPartialCatch.totalCountFromAPI,
            stateForPartialCatch.totalPagesAvailable,
            stateForPartialCatch.validationResults,
            undefined,
            searchType,
            searchCategory,
            strategy.id,
            stateForPartialCatch.streamTableId,
          ),
          error: {
            message: errorMessage,
            ...(errorCode ? { code: errorCode } : {}),
            details: errorMessage,
          },
        };
      }
      return this.handleError(error, strategy);
    }
  }

  private emitProgressiveCandidateTable(
    sendEvent: ((event: string, data: unknown) => boolean | void) | undefined,
    streamTableId: string | undefined,
    allTransformed: TransformedCandidateForTable[],
    candidateScores: Map<string, CandidateRelevanceScoring>,
  ): void {
    if (!sendEvent || !streamTableId) {
      return;
    }
    const withScores = this.attachScoresToCandidates(
      allTransformed,
      candidateScores,
    );
    const columns = ['name', 'headline', 'jobTitle', 'jobCompanyName'];
    const rows = withScores.filter((candidate) => {
      const candidateName = candidate.name?.trim() ?? '';
      return candidateName.length > 0;
    });
    if (rows.length === 0) {
      return;
    }
    const label = `${rows.length} candidate${rows.length !== 1 ? 's' : ''}`;
    sendEvent('table_data', {
      tableId: streamTableId,
      tableType: 'candidates',
      label,
      columns,
      rows,
    });
  }

  private shouldAbort(sendEvent?: (event: string, data: any) => boolean | void): boolean {
    const eventResult = sendEvent?.('status', { message: 'Checking stream status...' });
    return eventResult === false;
  }

  private async fetchPage(
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
  ): Promise<{
    items: LinkedInSearchResult[];
    transformed: TransformedCandidateForTable[];
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
    // Must align with CandidateSearchBaseService.shouldUseRawEndpointForClassicPeople so that
    // when the base service uses the raw endpoint (params or env), we pass start for page 2+.
    const rawFromParams =
      strategyResolvedParams.classicPeopleSearch?.useRawEndpoint ??
      (strategyResolvedParams as { useRawEndpoint?: boolean }).useRawEndpoint;
    const rawFromEnv = (() => {
      const envRaw = process.env.LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT;
      return envRaw !== undefined && envRaw !== '' && (envRaw === 'true' || envRaw === '1');
    })();
    const useRawClassicPeople =
      !forceClassicPeopleJson &&
      searchType === 'classic' &&
      searchCategory === 'people' &&
      (rawFromParams === true || rawFromEnv);
    const start =
      useRawClassicPeople && currentPage > 1 ? (currentPage - 1) * pageLimit : undefined;

    this.logger.log(
      `Fetching page ${currentPage}${start !== undefined ? ` (start=${start})` : ''}`,
    );

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

    let transformedCandidates: TransformedCandidateForTable[] = [];
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

  private async processPageResults(
    pageItems: LinkedInSearchResult[],
    pageTransformed: TransformedCandidateForTable[],
    currentPage: number,
    totalItemsCount: number,
    strategy: PeopleSearchStrategyResult,
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    parsedJobDescription: ParsedJobDescription,
    userMessage: string,
    apiToken: string,
    candidateScores: Map<string, CandidateRelevanceScoring>,
    validationResults: Array<{ page: number; validation: ResultValidationResult; timestamp: string }>,
    allTransformedCandidates: TransformedCandidateForTable[],
    streamTableId: string | undefined,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<boolean> {
    if (this.shouldAbort(sendEvent)) {
      this.logger.log('Stream aborted, stopping validation');
      return false;
    }

    sendEvent?.('status', { message: `Validating page ${currentPage} results...` });
    // Validate page results
    const validationResult = await this.resultValidationService.validateResultsAgainstQuery(
      pageItems,
      userMessage,
      apiToken,
      sendEvent,
    );

    validationResults.push({
      page: currentPage,
      validation: validationResult,
      timestamp: new Date().toISOString(),
    });

    this.sendValidationEvent(currentPage, validationResult, sendEvent);

    // Score candidates
    if (pageItems.length > 0) {
      sendEvent?.('status', { message: `Scoring ${pageItems.length} candidates...` });

      const pageScores = await this.candidateScoringService.scoreCandidatesBatch(
        pageItems,
        searchCategory,
        searchType,
        userMessage,
        apiToken,
        parsedJobDescription,
        sendEvent,
        strategy.strategyText,
      );

      await this.logPageScoresAndValidation(pageScores, currentPage, pageItems, validationResult);

      // Merge scores
      pageScores.forEach((score, candidateId) => {
        candidateScores.set(candidateId, score);
      });

      // Attach scores and send batch
      const pageTransformedWithScores = this.attachScoresToCandidates(pageTransformed, pageScores);
      sendEvent?.('candidateBatch', {
        strategyId: strategy.id,
        strategyLabel: strategy.label,
        page: currentPage,
        transformedCandidates: pageTransformedWithScores,
        totalCandidatesSoFar: totalItemsCount,
      });

      this.emitProgressiveCandidateTable(
        sendEvent,
        streamTableId,
        allTransformedCandidates,
        candidateScores,
      );
    }

    // Decide whether to continue
    const shouldContinue = this.resultValidationService.shouldContinuePagination(
      validationResult,
      totalItemsCount,
      currentPage,
    );

    if (!shouldContinue) {
      this.logger.log(
        `Stopping pagination for strategy ${strategy.id} at page ${currentPage}: ${validationResult.reasoning || 'Validation determined no more pages needed'}`,
      );
      sendEvent?.('status', {
        message: `Stopping pagination after page ${currentPage}. ${validationResult.reasoning || 'Quality threshold met or validation determined no more pages needed.'}`,
      });
    } else {
      this.logger.log(
        `Continuing pagination for strategy ${strategy.id}: page ${currentPage} validation passed, continuing to page ${currentPage + 1}`,
      );
    }

    return shouldContinue;
  }

  private sendValidationEvent(
    page: number | 'all',
    validationResult: ResultValidationResult,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): void {
    const falsePositivesText = validationResult.falsePositives?.length
      ? `\nFalse positives: ${validationResult.falsePositives.slice(0, 3).join(', ')}${validationResult.falsePositives.length > 3 ? '...' : ''}`
      : '';
    const reasoningText = validationResult.reasoning ? `\n${validationResult.reasoning}` : '';
    const pageLabel = page === 'all' ? 'Overall' : `Page ${page}`;

    sendEvent?.('validation', {
      page,
      validation: validationResult,
      message: `${pageLabel} validation: ${validationResult.qualityAssessment} quality, ${(validationResult.relevanceScore * 100).toFixed(0)}% relevance${falsePositivesText}${reasoningText}`,
    });
  }

  private attachScoresToCandidates(
    candidates: TransformedCandidateForTable[],
    scores: Map<string, CandidateRelevanceScoring>,
  ): TransformedCandidateForTable[] {
    return candidates.map((candidate) => {
      const candidateId = candidate.tempId || candidate.id || candidate.peopleId || '';
      const candidateName = candidate.name || '';
      const score = scores.get(candidateId) || scores.get(candidateName);

      if (!score) {
        return candidate;
      }

      return {
        ...candidate,
        relevanceScore: score.relevanceScore ?? undefined,
        relevanceLabel: score.relevanceLabel ?? undefined,
        matchReasons: score.matchReasons ?? undefined,
        mismatchReasons: score.mismatchReasons ?? undefined,
      };
    });
  }

  private attachScoresToAllCandidates(
    allTransformedCandidates: TransformedCandidateForTable[],
    allItems: LinkedInSearchResult[],
    candidateScores: Map<string, CandidateRelevanceScoring>,
  ): void {
    if (candidateScores.size === 0) {
      return;
    }

    // Attach scores to transformed candidates
    const candidatesWithScores = this.attachScoresToCandidates(allTransformedCandidates, candidateScores);
    allTransformedCandidates.length = 0;
    allTransformedCandidates.push(...candidatesWithScores);

    // Sort by relevance score
    allTransformedCandidates.sort((a, b) => {
      const scoreA = a.relevanceScore ?? 0;
      const scoreB = b.relevanceScore ?? 0;
      return scoreB - scoreA;
    });

    // Sort raw items by relevance
    allItems.sort((a, b) => {
      const getId = (item: LinkedInSearchResult): string => {
        if (item.id) return item.id;
        if (item.type === 'PEOPLE' && 'member_urn' in item) {
          return item.member_urn || '';
        }
        return '';
      };
      const idA = getId(a);
      const idB = getId(b);
      const scoreA = candidateScores.get(idA)?.relevanceScore ?? 0;
      const scoreB = candidateScores.get(idB)?.relevanceScore ?? 0;
      return scoreB - scoreA;
    });
  }

  private async performFinalValidation(
    allItems: LinkedInSearchResult[],
    userMessage: string | undefined,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<ResultValidationResult | undefined> {
    if (!userMessage || allItems.length === 0) {
      return undefined;
    }

    sendEvent?.('status', { message: `Performing final validation on all results...` });

    const overallValidation = await this.resultValidationService.validateResultsAgainstQuery(
      allItems,
      userMessage,
      apiToken,
      sendEvent,
    );

    this.sendValidationEvent('all', overallValidation, sendEvent);

    return overallValidation;
  }

  private sendFinalBatch(
    allTransformedCandidates: TransformedCandidateForTable[],
    candidateScores: Map<string, CandidateRelevanceScoring>,
    strategy: PeopleSearchStrategyResult,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): void {
    if (allTransformedCandidates.length > 0 && candidateScores.size > 0 && sendEvent) {
      sendEvent('candidateBatch', {
        strategyId: strategy.id,
        strategyLabel: strategy.label,
        page: 'final',
        transformedCandidates: allTransformedCandidates,
        totalCandidatesSoFar: allTransformedCandidates.length,
        isFinalBatch: true,
      });
    }
  }

  private buildResponse(
    allItems: LinkedInSearchResult[],
    allTransformedCandidates: TransformedCandidateForTable[],
    firstPageConfig: LinkedInSearchConfig,
    currentCursor: string | undefined,
    currentPage: number,
    totalCountFromAPI: number | undefined,
    totalPagesAvailable: number | undefined,
    validationResults: Array<{ page: number; validation: ResultValidationResult; timestamp: string }>,
    overallValidation: ResultValidationResult | undefined,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    strategyId: string,
    streamTableId?: string,
  ): SearchExecutionPreview {
    const finalResponse: LinkedInSearchResponse = {
      object: 'LinkedinSearch',
      items: allItems,
      config: firstPageConfig,
      paging: {
        start: 0,
        page_count: currentPage,
        total_count: totalCountFromAPI ?? allItems.length,
      },
      cursor: currentCursor || null,
    };

    this.logger.log(
      `Strategy ${strategyId} multi-page search completed: ${allItems.length} total candidates fetched across ${currentPage} pages. ` +
      `Total available from API: ${totalCountFromAPI ?? 'unknown'}, Total pages available: ${totalPagesAvailable ?? 'unknown'}`,
    );

    return {
      itemCount: allItems.length,
      searchResults: finalResponse,
      transformedCandidates: allTransformedCandidates.length > 0 ? allTransformedCandidates : undefined,
      ...(streamTableId ? { streamTableId } : {}),
      searchMetadata: {
        searchType,
        searchCategory,
        timestamp: new Date().toISOString(),
        processingTime: 0,
      },
      validationResults: validationResults.length > 0 ? validationResults : undefined,
      overallValidation,
    };
  }

  private handleError(error: unknown, strategy: PeopleSearchStrategyResult): SearchExecutionPreview {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;

    this.logger.error(
      `Failed to execute multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'}):`,
      error,
    );

    let errorDetails: string | undefined;
    if (errorMessage.includes('Content too large')) {
      errorDetails = 'The search parameters are too complex. Try simplifying the search criteria.';
    } else if (errorMessage.includes('LinkedIn search failed')) {
      errorDetails = errorMessage.replace('LinkedIn search failed: ', '');
    }

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



  async logPageScoresAndValidation(
    pageScores: Map<string, CandidateRelevanceScoring>,
    currentPage: number,
    pageItems: LinkedInSearchResult[],
    validationResult: ResultValidationResult,
  ) {
    // One score per candidate: pageScores has multiple keys per candidate (id, urn, name), so derive
    // unique scores by looking up once per page item to avoid double-counting in stats/logs.
    const pageRelevanceScores = pageItems
      .map((item, index) => {
        const id = (item as { id?: string }).id;
        const urn = (item as { urn?: string }).urn;
        const name = (item as { name?: string }).name;
        const score =
          (id && pageScores.get(id)) ||
          (urn && pageScores.get(urn)) ||
          (name && pageScores.get(name)) ||
          pageScores.get(`${name || 'unknown'}-${index}`);
        return score?.relevanceScore;
      })
      .filter((score): score is number => score !== null && score !== undefined);
    const averagePageScore = pageRelevanceScores.length > 0
      ? pageRelevanceScores.reduce((sum, score) => sum + score, 0) / pageRelevanceScores.length
      : 0;
    
    if (pageRelevanceScores.length > 0) {
      this.logger.log(
        `Page ${currentPage} candidate scores - Average: ${(averagePageScore * 100).toFixed(2)}%, ` +
        `Count: ${pageRelevanceScores.length}, ` +
        `Min: ${(Math.min(...pageRelevanceScores) * 100).toFixed(2)}%, ` +
        `Max: ${(Math.max(...pageRelevanceScores) * 100).toFixed(2)}%`
      );
    } else {
      this.logger.log(
        `Page ${currentPage} candidate scores - No scores available (${pageItems.length} candidates)`
      );
    }
    
    // Compare average candidate score with validation result
    if (validationResult) {
      const validationScore = validationResult.relevanceScore;
      const scoreDifference = averagePageScore - validationScore;
      const scoreDifferencePercent = (scoreDifference * 100).toFixed(2);
      
      this.logger.log(
        `Page ${currentPage} score comparison - ` +
        `Average candidate score: ${(averagePageScore * 100).toFixed(2)}%, ` +
        `Validation score: ${(validationScore * 100).toFixed(2)}%, ` +
        `Difference: ${scoreDifference > 0 ? '+' : ''}${scoreDifferencePercent}% ` +
        `(${pageRelevanceScores.length} candidates scored)`
      );
    }
  }

  /**
   * Transform search results to table format
   */
  transformSearchResults(
    items: LinkedInSearchResult[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): TransformedCandidateForTable[] {
    if (!items || items.length === 0 || searchCategory !== 'people') {
      return [];
    }

    const transformer =
      searchType === 'recruiter'
        ? this.linkedinRecruiterPeopleTransformer
        : this.linkedinSearchResultTransformer;

    let transformed = transformer.transformSearchResultsToTableFormat(
      items,
      'linkedin_search_job',
      `${searchType} ${searchCategory} search results`,
    );
    
    transformed = transformer.addMetadataToCandidates(
      transformed,
      {
        searchType,
        searchCategory,
        timestamp: new Date().toISOString(),
        processingTime: 0,
      },
    );

    return transformed;
  }
}

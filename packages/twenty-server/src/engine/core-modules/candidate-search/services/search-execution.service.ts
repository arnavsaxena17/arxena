import { Injectable } from '@nestjs/common';
import { CandidateRelevanceScoring } from 'src/engine/core-modules/candidate-search/schemas/candidate-relevance-scoring.schema';
import { LinkedInSearchTransformerService, TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
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
    linkedinParameterResolver: LinkedinParameterResolver,
    parameterSanitizer: ParameterSanitizer,
    fileUtils: FileUtils,
    linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    staticGraphQLService: StaticGraphQLService,
    resumeReaderService: ResumeReaderService,
    jobDescriptionService: JobDescriptionService,
    // querySimplificationService: QuerySimplificationService,
    private readonly resultValidationService: ResultValidationService,
    private readonly candidateScoringService: CandidateScoringService,
  ) {
    super(
      linkedInSearchService,
      workspaceQueryService,
      linkedinParameterResolver,
      parameterSanitizer,
      fileUtils,
      linkedinSearchResultTransformer,
      staticGraphQLService,
      resumeReaderService,
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
  ): Promise<SearchExecutionPreview | null> {
    const pageLimit = 10;
    const maxPagesToFetch = maxPages || 7;

    try {
      if (!strategy.parameters) {
        this.logger.warn(`Strategy ${strategy.id} has no parameters, skipping search`);
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

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

        const pageResult = await this.fetchPage(
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          state.currentCursor,
          pageLimit,
          sendEvent,
          state.currentPage,
        );

        if (!pageResult || pageResult.items.length === 0) {
          break;
        }

        // Store first page config and pagination info
        if (state.currentPage === 1 && pageResult.config) {
          state.firstPageConfig = pageResult.config;
          if (pageResult.paging?.total_count !== undefined) {
            state.totalCountFromAPI = pageResult.paging.total_count;
            state.totalPagesAvailable = Math.ceil(pageResult.paging.total_count / pageLimit);
            
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
        });

        // Stop if page returned only duplicates (same results as before - API may not support pagination or has no more)
        if (newItemsNoVal.length === 0 && state.allItems.length > 0) {
          this.logger.log(
            `Stopping pagination for strategy ${strategy.id}: page ${state.currentPage} returned only duplicate results (0 new unique candidates). Likely no more results or pagination not supported.`,
          );
          break;
        }

        // Break if no more pages
        if (!state.currentCursor) {
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

    try {
      if (!strategy.parameters) {
        this.logger.warn(`Strategy ${strategy.id} has no parameters, skipping search`);
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      const maxPagesToFetch = 15; // Prevent excessive API calls (raw endpoint may return same page repeatedly)
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
      };

      this.logger.log(
        `Executing multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );

      // Main pagination loop
      while (state.currentPage <= maxPagesToFetch) {
        if (this.shouldAbort(sendEvent)) {
          this.logger.log('Stream aborted, stopping multi-page search');
          break;
        }

        const pageResult = await this.fetchPage(
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          state.currentCursor,
          pageLimit,
          sendEvent,
          state.currentPage,
        );

        if (!pageResult || pageResult.items.length === 0) {
          break;
        }

        // Store first page config and pagination info
        if (state.currentPage === 1 && pageResult.config) {
          state.firstPageConfig = pageResult.config;
          if (pageResult.paging?.total_count !== undefined) {
            state.totalCountFromAPI = pageResult.paging.total_count;
            state.totalPagesAvailable = Math.ceil(pageResult.paging.total_count / pageLimit);
            
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
        pageResult.items.forEach((item, idx) => {
          const key =
            (item as { public_identifier?: string }).public_identifier ??
            item.id ??
            (item as { name?: string }).name ??
            '';
          if (seenKeys.has(key)) return;
          seenKeys.add(key);
          newItems.push(item);
          if (pageResult.transformed[idx]) newTransformed.push(pageResult.transformed[idx]);
        });
        state.allItems.push(...newItems);
        state.allTransformedCandidates.push(...newTransformed);
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
            pageResult.items,
            pageResult.transformed,
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
            sendEvent,
          );

          if (!shouldContinue) {
            break;
          }
        } else if (!state.currentCursor) {
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

      return this.buildResponse(
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
      );
    } catch (error) {
      return this.handleError(error, strategy);
    }
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
  ): Promise<{
    items: LinkedInSearchResult[];
    transformed: TransformedCandidateForTable[];
    cursor?: string | null;
    config?: LinkedInSearchConfig;
    paging?: { total_count: number };
  } | null> {
    sendEvent?.('status', { message: `Fetching page...` });

    const accountId = await this.getLinkedInAccountId(apiToken);

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
      { cursor, limit: pageLimit, start },
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
      transformedCandidates = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
        searchResults.items,
        'linkedin_search_job',
        `${searchType} ${searchCategory} search results`,
      );
      
      transformedCandidates = this.linkedinSearchResultTransformer.addMetadataToCandidates(
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

    let transformed = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
      items,
      'linkedin_search_job',
      `${searchType} ${searchCategory} search results`,
    );
    
    transformed = this.linkedinSearchResultTransformer.addMetadataToCandidates(
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


import { type Logger } from '@nestjs/common';

import {
  type LinkedInStrategySource,
  type PeopleSearchStrategyResult,
  type SearchExecutionOptions,
  type StrategyRow,
  strategyRowKey,
  transformedOf,
} from 'src/domains/org-graph/org-chart/build/services/linkedin-strategy-source.service';
import { type ResultValidationService } from 'src/domains/evaluation/result-validation.service';
import { type ResultValidationResult } from 'src/domains/discovery/query/types/candidate-search-request.type';
import {
  runFetchRound,
  type FetchRoundPage,
} from 'src/domains/ingestion/candidate-sourcing/run/round.util';
import { type CandidateTableRow } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import {
  type LinkedInSearchConfig,
  type LinkedInSearchResponse,
  type LinkedInSearchResult,
} from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-response.type';
import {
  getLinkedInUnipileSearchPageLimit,
  randomOrgChartLinkedInPageDelayMs,
} from 'src/domains/org-graph/org-chart/utils/orgchart-linkedin-scope.util';

// One strategy searched to the end: the source fetches pages, the fetch round
// decides when to stop, and this turns the result into what callers show.

type SearchType = 'classic' | 'sales_navigator' | 'recruiter';
type SearchCategory = 'people' | 'companies' | 'posts' | 'jobs';
type SendEvent = (event: string, data: unknown) => boolean | void;

type PageValidation = {
  page: number;
  validation: ResultValidationResult;
  timestamp: string;
};

export type SearchExecutionPreview = {
  itemCount: number;
  searchResults: LinkedInSearchResponse | null;
  transformedCandidates?: CandidateTableRow[];
  // When set, the final assistant `table_data` reuses this id so rows are not
  // duplicated in the UI
  streamTableId?: string;
  searchMetadata?: {
    searchType: SearchType;
    searchCategory: SearchCategory;
    timestamp: string;
    processingTime: number;
  };
  validationResults?: PageValidation[];
  overallValidation?: ResultValidationResult;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
};

// A chat search shows rows as they arrive, keeps what it has if a page fails
// and stops at ten pages. With a review it also checks each page against the
// request before fetching the next.
export type StrategySearchStream = {
  review?: {
    userMessage: string;
    resultValidationService: Pick<
      ResultValidationService,
      'validateResultsAgainstQuery' | 'shouldContinuePagination'
    >;
  };
};

const STREAMED_MAX_PAGES = 10;
const TABLE_COLUMNS = ['name', 'headline', 'jobTitle', 'jobCompanyName'];

const sleepMs = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const errorOf = (error: unknown): { message: string; code?: string } => ({
  message: error instanceof Error ? error.message : String(error),
  ...(error instanceof Error && 'code' in error
    ? { code: String((error as { code?: string }).code) }
    : {}),
});

// The stream reports whether the client is still there when it is written to
const isAborted = (sendEvent: SendEvent | undefined): boolean =>
  sendEvent?.('status', { message: 'Checking stream status...' }) === false;

const failedPreview = (
  error: unknown,
  strategy: PeopleSearchStrategyResult,
  logger: Logger,
): SearchExecutionPreview => {
  const { message, code } = errorOf(error);

  logger.error(
    `Failed to execute multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'}):`,
    error,
  );

  const details = message.includes('Content too large')
    ? 'The search parameters are too complex. Try simplifying the search criteria.'
    : message.includes('LinkedIn search failed')
      ? message.replace('LinkedIn search failed: ', '')
      : message;

  return {
    itemCount: 0,
    searchResults: null,
    transformedCandidates: undefined,
    searchMetadata: undefined,
    error: { message, code, details },
  };
};

const emitCandidateTable = (
  sendEvent: SendEvent | undefined,
  streamTableId: string | undefined,
  candidates: CandidateTableRow[],
): void => {
  if (sendEvent === undefined || streamTableId === undefined) {
    return;
  }

  const rows = candidates.filter(
    (candidate) => (candidate.name?.trim() ?? '').length > 0,
  );

  if (rows.length === 0) {
    return;
  }

  sendEvent('table_data', {
    tableId: streamTableId,
    tableType: 'candidates',
    label: `${rows.length} candidate${rows.length !== 1 ? 's' : ''}`,
    columns: TABLE_COLUMNS,
    rows,
  });
};

const sendPageProgress = (
  strategy: PeopleSearchStrategyResult,
  page: FetchRoundPage<StrategyRow>,
  pageLimit: number,
  sendEvent: SendEvent | undefined,
  logger: Logger,
): void => {
  if (page.page === 1 && page.counts !== undefined) {
    logger.log(
      `Strategy ${strategy.id} pagination info: Total results available: ${page.counts}, Total pages: ${page.totalPages}, Page limit: ${pageLimit}`,
    );
    sendEvent?.('paginationInfo', {
      strategyId: strategy.id,
      strategyLabel: strategy.label,
      totalCount: page.counts,
      totalPages: page.totalPages,
      pageLimit,
    });
  }

  logger.log(
    `Strategy ${strategy.id} page ${page.page}: ${page.pageItems.length} candidates (total: ${page.totalItems})`,
  );
  sendEvent?.('pageResults', {
    page: page.page,
    candidatesReceived: page.pageItems.length,
    totalCandidates: page.totalItems,
    totalCountFromAPI: page.counts,
    totalPages: page.totalPages,
    strategyId: strategy.id,
    strategyLabel: strategy.label,
    remainingToFetch:
      page.counts !== undefined
        ? Math.max(0, page.counts - page.totalItems)
        : undefined,
  });
};

export const runStrategySearch = async ({
  source,
  logger,
  strategy,
  searchType,
  searchCategory,
  parameterKey,
  apiToken,
  sendEvent,
  executionOptions,
  maxPages,
  stream,
}: {
  source: Pick<LinkedInStrategySource, 'withSession' | 'prepare' | 'fetchPage'>;
  logger: Logger;
  strategy: PeopleSearchStrategyResult;
  searchType: SearchType;
  searchCategory: SearchCategory;
  parameterKey: string;
  apiToken: string;
  sendEvent?: SendEvent;
  executionOptions?: SearchExecutionOptions;
  // Pages this search may fetch; a streamed search stops at ten regardless
  maxPages?: number;
  stream?: StrategySearchStream;
}): Promise<SearchExecutionPreview | null> =>
  source.withSession(apiToken, executionOptions, async (options) => {
    const pageLimit = getLinkedInUnipileSearchPageLimit(searchType);
    const isStreamed = stream !== undefined;
    const review = stream?.review;
    const maxCandidates =
      typeof options?.maxCandidates === 'number' && options.maxCandidates > 0
        ? options.maxCandidates
        : undefined;
    const isThrottled = options?.throttlePages === true;
    const pageDelayMs = (): number =>
      typeof options?.pageDelayMs === 'function'
        ? options.pageDelayMs()
        : randomOrgChartLinkedInPageDelayMs();
    // Kept outside the round so a failure part-way still returns what was
    // collected
    const allItems: LinkedInSearchResult[] = [];
    const allTransformed: CandidateTableRow[] = [];
    const validationResults: PageValidation[] = [];
    const streamTableId =
      isStreamed && sendEvent !== undefined && searchCategory === 'people'
        ? crypto.randomUUID()
        : undefined;
    let firstPageConfig: LinkedInSearchConfig = { params: {} };
    let lastPage: FetchRoundPage<StrategyRow> | undefined;

    const respond = (
      cursor: string | undefined,
      pages: number,
    ): SearchExecutionPreview => {
      const pageCount = Math.max(1, pages);

      logger.log(
        `Strategy ${strategy.id} multi-page search completed: ${allItems.length} total candidates fetched across ${pageCount} pages. ` +
          `Total available from API: ${lastPage?.counts ?? 'unknown'}, Total pages available: ${lastPage?.totalPages ?? 'unknown'}`,
      );

      return {
        itemCount: allItems.length,
        searchResults: {
          object: 'LinkedinSearch',
          items: allItems,
          config: firstPageConfig,
          paging: {
            start: 0,
            page_count: pageCount,
            total_count: lastPage?.counts ?? allItems.length,
          },
          cursor: cursor || null,
        },
        transformedCandidates:
          allTransformed.length > 0 ? allTransformed : undefined,
        ...(streamTableId !== undefined ? { streamTableId } : {}),
        searchMetadata: {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime: 0,
        },
        validationResults:
          validationResults.length > 0 ? validationResults : undefined,
        overallValidation: undefined,
      };
    };

    const sendFinalBatch = (): void => {
      if (allTransformed.length > 0) {
        sendEvent?.('candidateBatch', {
          strategyId: strategy.id,
          strategyLabel: strategy.label,
          page: 'final',
          transformedCandidates: allTransformed,
          totalCandidatesSoFar: allTransformed.length,
          isFinalBatch: true,
        });
      }
    };

    // Each page is checked against the request before the next is fetched
    const reviewPage = async (
      page: FetchRoundPage<StrategyRow>,
    ): Promise<boolean> => {
      if (review === undefined) {
        return true;
      }

      if (isAborted(sendEvent)) {
        logger.log('Stream aborted, stopping validation');

        return false;
      }

      const pageItems = page.pageItems.map((row) => row.item);

      sendEvent?.('status', {
        message: `Validating page ${page.page} results...`,
      });

      const validation =
        await review.resultValidationService.validateResultsAgainstQuery(
          pageItems,
          review.userMessage,
          apiToken,
          sendEvent,
        );

      validationResults.push({
        page: page.page,
        validation,
        timestamp: new Date().toISOString(),
      });

      const falsePositives = validation.falsePositives?.length
        ? `\nFalse positives: ${validation.falsePositives.slice(0, 3).join(', ')}${validation.falsePositives.length > 3 ? '...' : ''}`
        : '';

      sendEvent?.('validation', {
        page: page.page,
        validation,
        message: `Page ${page.page} validation: ${validation.qualityAssessment} quality, ${(validation.relevanceScore * 100).toFixed(0)}% relevance${falsePositives}${validation.reasoning ? `\n${validation.reasoning}` : ''}`,
      });

      // Rows go out as fetched. Whether a row qualifies is decided once, by
      // the fitment judge on the project tab, not per candidate here.
      if (pageItems.length > 0) {
        sendEvent?.('candidateBatch', {
          strategyId: strategy.id,
          strategyLabel: strategy.label,
          page: page.page,
          transformedCandidates: transformedOf(page.pageItems),
          totalCandidatesSoFar: page.totalItems,
        });
        emitCandidateTable(sendEvent, streamTableId, allTransformed);
      }

      const shouldContinue =
        review.resultValidationService.shouldContinuePagination(
          validation,
          page.totalItems,
          page.page,
        );

      if (!shouldContinue) {
        logger.log(
          `Stopping pagination for strategy ${strategy.id} at page ${page.page}: ${validation.reasoning || 'Validation determined no more pages needed'}`,
        );
        sendEvent?.('status', {
          message: `Stopping pagination after page ${page.page}. ${validation.reasoning || 'Quality threshold met or validation determined no more pages needed.'}`,
        });
      }

      return shouldContinue;
    };

    try {
      const prepared = await source.prepare(
        strategy,
        searchType,
        searchCategory,
        parameterKey,
        apiToken,
        options,
      );

      if (prepared === null) {
        return null;
      }

      logger.log(
        `Executing multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );

      const round = await runFetchRound<StrategyRow>({
        fetchPage: (request) =>
          source.fetchPage(
            prepared,
            searchType,
            searchCategory,
            apiToken,
            pageLimit,
            request,
            sendEvent,
            options,
            (config) => {
              firstPageConfig = config;
            },
          ),
        keyOf: strategyRowKey,
        pageSize: pageLimit,
        maxPages: isStreamed
          ? STREAMED_MAX_PAGES
          : typeof maxPages === 'number' && maxPages > 0
            ? maxPages
            : Number.MAX_SAFE_INTEGER,
        ...(maxCandidates !== undefined && { maxRows: maxCandidates }),
        keepRowsOnError: isStreamed,
        isAborted: () => isAborted(sendEvent),
        beforePage: async (page, totalItems) => {
          if (
            page === 1 &&
            isThrottled &&
            options?.throttleBeforeFirstPage === true
          ) {
            const delayMs = pageDelayMs();

            logger.log(
              `Throttling before first LinkedIn page for strategy ${strategy.id}: sleeping ${delayMs}ms`,
            );
            await sleepMs(delayMs);
          }

          sendEvent?.('status', {
            message: `Fetching page ${page}${totalItems > 0 ? ` (${totalItems} candidates collected so far)` : ''}...`,
            page,
            candidatesCollectedSoFar: totalItems,
          });
        },
        onPage: (page) => {
          lastPage = page;
          allItems.push(...page.newItems.map((row) => row.item));
          allTransformed.push(...transformedOf(page.newItems));

          if (isStreamed && page.newItems.length > 0) {
            emitCandidateTable(sendEvent, streamTableId, allTransformed);
          }

          sendPageProgress(strategy, page, pageLimit, sendEvent, logger);
        },
        ...(review !== undefined && { shouldContinue: reviewPage }),
        betweenPages: async (nextPage) => {
          if (!isThrottled) {
            return;
          }

          const delayMs = pageDelayMs();

          logger.log(
            `Throttling LinkedIn pagination: sleeping ${delayMs}ms before page ${nextPage}`,
          );
          await sleepMs(delayMs);
        },
      });

      logger.log(
        `Strategy ${strategy.id} (${strategy.label || 'unnamed'}) stopped: ${round.stoppedBecause}`,
      );

      if (isStreamed) {
        sendFinalBatch();
      }

      const preview = respond(round.cursor, round.pages);

      if (round.stoppedBecause !== 'error') {
        return preview;
      }

      const fetchError = errorOf(round.error);

      logger.error(
        `Fetch failed for strategy ${strategy.id} after ${round.pages} page(s):`,
        round.error,
      );
      sendEvent?.('status', {
        message:
          allItems.length > 0
            ? `Could not load page ${round.pages + 1}; returning ${allItems.length} candidate${allItems.length !== 1 ? 's' : ''} from earlier pages.`
            : `Search request failed: ${fetchError.message}`,
      });

      return {
        ...preview,
        error: {
          ...fetchError,
          details:
            allItems.length > 0
              ? `Stopped after page ${round.pages}. ${fetchError.message}`
              : fetchError.message,
        },
      };
    } catch (error) {
      // A streamed search that already has rows hands them back with the error
      if (!isStreamed || allItems.length === 0) {
        return failedPreview(error, strategy, logger);
      }

      sendFinalBatch();
      emitCandidateTable(sendEvent, streamTableId, allTransformed);

      const failure = errorOf(error);

      return {
        ...respond(undefined, lastPage?.page ?? 1),
        error: { ...failure, details: failure.message },
      };
    }
  });

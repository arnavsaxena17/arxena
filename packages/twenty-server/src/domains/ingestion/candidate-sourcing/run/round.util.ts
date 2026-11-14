// FETCH: run one candidate (one source x one query) page by page until a rule
// says stop. This is the only paging loop: every search, the org chart
// included, pages through here, and what it returns is what one ledger
// `search` row records.

export type FetchedPage<TItem> = {
  items: TItem[];
  // Rows the source says match. Leave it out when the source cannot be
  // trusted on it (a classic LinkedIn page only knows its own size).
  counts?: number;
  // Whether the source can serve another page. A cursor-paged source says no
  // when it returns no cursor; an offset-paged one always says yes and is
  // stopped by an empty or duplicate page.
  hasMore: boolean;
  cursor?: string;
};

export type FetchRoundStop =
  | 'empty_page'
  | 'duplicates_only'
  | 'last_page'
  | 'max_rows'
  | 'max_pages'
  | 'no_more_pages'
  | 'declined'
  | 'aborted'
  | 'error';

export type FetchRoundPage<TItem> = {
  page: number;
  // The page as the source returned it, duplicates included
  pageItems: TItem[];
  // The rows of this page not seen earlier in the round
  newItems: TItem[];
  // Where each new row sat in pageItems, for callers that keep a parallel list
  newIndexes: number[];
  // Unique rows collected so far, this page included
  totalItems: number;
  counts: number | undefined;
  totalPages: number | undefined;
};

export type FetchRoundResult<TItem> = {
  items: TItem[];
  // Pages that returned rows
  pages: number;
  // Rows received, duplicates included
  fetched: number;
  duplicates: number;
  counts: number | undefined;
  totalPages: number | undefined;
  // The cursor after the last page, so a later round can resume
  cursor: string | undefined;
  stoppedBecause: FetchRoundStop;
  // Set when stoppedBecause is 'error': the rows already collected are kept
  error?: unknown;
};

export type FetchRoundOptions<TItem> = {
  fetchPage: (request: {
    page: number;
    cursor: string | undefined;
  }) => Promise<FetchedPage<TItem> | null>;
  keyOf: (item: TItem) => string;
  pageSize: number;
  // Pages this round may fetch
  maxPages: number;
  maxRows?: number;
  // Where an earlier round of the same candidate left off
  resumeFrom?: {
    page: number;
    cursor: string | undefined;
    // The count the first page reported, so the last page is still known
    counts?: number;
  };
  isAborted?: () => boolean;
  // Runs before each fetch: pacing, and "fetching page N" status
  beforePage?: (page: number, totalItems: number) => Promise<void>;
  // Runs once the page is deduplicated: progress events
  onPage?: (page: FetchRoundPage<TItem>) => void | Promise<void>;
  // Runs on a page that added rows; false ends the round. This is where a
  // caller checks quality before paying for the next page.
  shouldContinue?: (page: FetchRoundPage<TItem>) => boolean | Promise<boolean>;
  // Runs between pages, after every stop rule has passed
  betweenPages?: (nextPage: number) => Promise<void>;
  // Keep what was collected when a page fails, instead of throwing
  keepRowsOnError?: boolean;
};

export const runFetchRound = async <TItem>(
  options: FetchRoundOptions<TItem>,
): Promise<FetchRoundResult<TItem>> => {
  const items: TItem[] = [];
  const seen = new Set<string>();
  const firstPage = options.resumeFrom?.page ?? 1;
  const lastPage = firstPage + options.maxPages - 1;
  let page = firstPage;
  let pages = 0;
  let fetched = 0;
  let cursor = options.resumeFrom?.cursor;
  let counts = options.resumeFrom?.counts;
  let totalPages =
    counts === undefined ? undefined : Math.ceil(counts / options.pageSize);

  const done = (
    stoppedBecause: FetchRoundStop,
    error?: unknown,
  ): FetchRoundResult<TItem> => ({
    items,
    pages,
    fetched,
    duplicates: fetched - items.length,
    counts,
    totalPages,
    cursor,
    stoppedBecause,
    ...(error !== undefined && { error }),
  });

  while (page <= lastPage) {
    await options.beforePage?.(page, items.length);

    if (options.isAborted?.() === true) {
      return done('aborted');
    }

    let fetchedPage: FetchedPage<TItem> | null;

    try {
      fetchedPage = await options.fetchPage({ page, cursor });
    } catch (error) {
      if (options.keepRowsOnError === true) {
        return done('error', error);
      }

      throw error;
    }

    if (fetchedPage === null || fetchedPage.items.length === 0) {
      return done('empty_page');
    }

    pages += 1;
    fetched += fetchedPage.items.length;

    if (page === 1 && fetchedPage.counts !== undefined) {
      counts = fetchedPage.counts;
      totalPages = Math.ceil(counts / options.pageSize);
    }

    const newItems: TItem[] = [];
    const newIndexes: number[] = [];

    fetchedPage.items.forEach((item, index) => {
      const key = options.keyOf(item);

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      newItems.push(item);
      newIndexes.push(index);
    });

    items.push(...newItems);
    cursor = fetchedPage.cursor;

    const pageInfo: FetchRoundPage<TItem> = {
      page,
      pageItems: fetchedPage.items,
      newItems,
      newIndexes,
      totalItems: items.length,
      counts,
      totalPages,
    };

    await options.onPage?.(pageInfo);

    // The source served rows the round already has: it has nothing new, or
    // it does not page
    if (newItems.length === 0) {
      return done('duplicates_only');
    }

    if (
      options.shouldContinue !== undefined &&
      !(await options.shouldContinue(pageInfo))
    ) {
      return done('declined');
    }

    if (totalPages !== undefined && page >= totalPages) {
      return done('last_page');
    }

    if (options.maxRows !== undefined && items.length >= options.maxRows) {
      return done('max_rows');
    }

    if (!fetchedPage.hasMore) {
      return done('no_more_pages');
    }

    if (page >= lastPage) {
      return done('max_pages');
    }

    // An abort during the pause is caught by the check before the next fetch
    await options.betweenPages?.(page + 1);

    page += 1;
  }

  return done('max_pages');
};

// Whether the candidate can still give new rows in a later round: the stop
// rules read this to decide the run is exhausted
export const canFetchMore = (stoppedBecause: FetchRoundStop): boolean =>
  stoppedBecause === 'max_rows' ||
  stoppedBecause === 'max_pages' ||
  stoppedBecause === 'declined' ||
  stoppedBecause === 'aborted' ||
  stoppedBecause === 'error';

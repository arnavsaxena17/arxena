import { runStrategySearch } from 'src/domains/org-graph/org-chart/build/services/strategy-search.util';

type Page = {
  items: Array<{ id: string; type: 'PEOPLE' }>;
  transformed: Array<{ name: string }>;
  cursor?: string | null;
  config?: { params: Record<string, unknown> };
  paging?: { total_count: number };
} | null;

const page = (
  ids: string[],
  extras: { cursor?: string | null; total?: number } = {},
): Page => ({
  items: ids.map((id) => ({ id, type: 'PEOPLE' })),
  transformed: ids.map((id) => ({ name: `Person ${id}` })),
  cursor: extras.cursor ?? null,
  config: { params: { api: 'classic' } },
  ...(extras.total !== undefined && { paging: { total_count: extras.total } }),
});

const STRATEGY = {
  id: 'strategy-1',
  label: 'CFOs',
  parameters: { keywords: 'cfo' },
};

// A LinkedIn source that serves canned pages; the session is already resolved
const createSource = (pages: Array<Page | Error>) => {
  const rawPage = jest.fn(
    async (_cursor: string | undefined, _page: number) => {
      const next = pages.shift() ?? null;

      if (next instanceof Error) {
        throw next;
      }

      return next;
    },
  );
  const source = {
    withSession: jest.fn(
      (
        _apiToken: string,
        options: Record<string, unknown> | undefined,
        run: (options: Record<string, unknown> | undefined) => unknown,
      ) => run(options),
    ),
    prepare: jest.fn(async (strategy: { parameters?: unknown }) =>
      strategy.parameters === undefined
        ? null
        : {
            resolvedParams: {},
            forceClassicPeopleJson: false,
            usesRawClassicPeople: false,
          },
    ),
    fetchPage: jest.fn(
      async (
        _prepared: unknown,
        _searchType: unknown,
        _searchCategory: unknown,
        _apiToken: unknown,
        _pageLimit: unknown,
        request: { page: number; cursor: string | undefined },
        _sendEvent: unknown,
        _options: unknown,
        onFirstPageConfig: (config: {
          params: Record<string, unknown>;
        }) => void,
      ) => {
        const raw = await rawPage(request.cursor, request.page);

        if (raw === null) {
          return null;
        }

        if (request.page === 1 && raw.config) {
          onFirstPageConfig(raw.config);
        }

        const cursor = raw.cursor ?? undefined;

        return {
          items: raw.items.map((item, index) => ({
            item,
            transformed: raw.transformed[index],
          })),
          ...(raw.paging !== undefined && { counts: raw.paging.total_count }),
          hasMore: cursor !== undefined,
          ...(cursor !== undefined && { cursor }),
        };
      },
    ),
  };

  return { source, fetchPage: rawPage };
};

const LOGGER = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

const OPTIONS = { linkedInAccountId: 'account-1' };

const runUnvalidated = (
  source: ReturnType<typeof createSource>['source'],
  extras: {
    maxPages?: number;
    sendEvent?: jest.Mock;
    options?: Record<string, unknown>;
    strategy?: Record<string, unknown>;
  } = {},
) =>
  runStrategySearch({
    source: source as never,
    logger: LOGGER as never,
    strategy: (extras.strategy ?? STRATEGY) as never,
    searchType: 'sales_navigator',
    searchCategory: 'people',
    parameterKey: 'salesNavigatorPeopleSearch',
    apiToken: 'token',
    ...(extras.maxPages !== undefined && { maxPages: extras.maxPages }),
    ...(extras.sendEvent !== undefined && { sendEvent: extras.sendEvent }),
    executionOptions: { ...OPTIONS, ...extras.options },
  });

describe('runStrategySearch', () => {
  it('should follow the cursor until the source returns none', async () => {
    const { source, fetchPage } = createSource([
      page(['a', 'b'], { cursor: 'c1', total: 1000 }),
      page(['c']),
    ]);

    const result = await runUnvalidated(source);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage.mock.calls[1][0]).toBe('c1');
    expect(result).toMatchObject({
      itemCount: 3,
      transformedCandidates: [
        { name: 'Person a' },
        { name: 'Person b' },
        { name: 'Person c' },
      ],
      searchResults: {
        config: { params: { api: 'classic' } },
        paging: { page_count: 2, total_count: 1000 },
      },
    });
  });

  it('should stop at one page when the source gives no cursor', async () => {
    const { source, fetchPage } = createSource([page(['a']), page(['b'])]);

    const result = await runUnvalidated(source);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result?.itemCount).toBe(1);
  });

  it('should drop rows already collected and stop on a page of duplicates', async () => {
    const { source, fetchPage } = createSource([
      page(['a', 'b'], { cursor: 'c1' }),
      page(['b', 'a'], { cursor: 'c2' }),
      page(['z'], { cursor: 'c3' }),
    ]);

    const result = await runUnvalidated(source);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result?.itemCount).toBe(2);
  });

  it('should respect maxPages and maxCandidates', async () => {
    const pages = () => [
      page(['a', 'b'], { cursor: 'c1' }),
      page(['c', 'd'], { cursor: 'c2' }),
      page(['e', 'f'], { cursor: 'c3' }),
    ];
    const byPages = createSource(pages());
    const byRows = createSource(pages());

    await runUnvalidated(byPages.source, { maxPages: 1 });
    const capped = await runUnvalidated(byRows.source, {
      options: { maxCandidates: 3 },
    });

    expect(byPages.fetchPage).toHaveBeenCalledTimes(1);
    expect(byRows.fetchPage).toHaveBeenCalledTimes(2);
    expect(capped?.itemCount).toBe(4);
  });

  it('should report pagination and page progress', async () => {
    const { source } = createSource([
      page(['a', 'b'], { cursor: 'c1', total: 1000 }),
      page(['c', 'd']),
    ]);
    const sendEvent = jest.fn(
      (_event: string, _data?: { message?: string }) => true,
    );

    await runUnvalidated(source, { sendEvent });

    // The abort check is itself a status event; it is not progress
    const events = sendEvent.mock.calls
      .filter(([, data]) => data?.message !== 'Checking stream status...')
      .map(([event]) => event);

    expect(events).toEqual([
      'status',
      'paginationInfo',
      'pageResults',
      'status',
      'pageResults',
    ]);
    expect(sendEvent).toHaveBeenCalledWith(
      'paginationInfo',
      expect.objectContaining({ totalCount: 1000 }),
    );
  });

  it('should stop without fetching when the stream is aborted', async () => {
    const { source, fetchPage } = createSource([page(['a'])]);

    const result = await runUnvalidated(source, {
      sendEvent: jest.fn(() => false),
    });

    expect(fetchPage).not.toHaveBeenCalled();
    expect(result?.itemCount).toBe(0);
  });

  it('should return an error preview when the first page fails', async () => {
    const { source } = createSource([new Error('LinkedIn search failed: 502')]);

    const result = await runUnvalidated(source);

    expect(result).toMatchObject({
      itemCount: 0,
      error: { message: 'LinkedIn search failed: 502', details: '502' },
    });
  });

  it('should keep earlier pages when a later page fails in a chat search', async () => {
    const { source } = createSource([
      page(['a', 'b'], { cursor: 'c1' }),
      new Error('rate limited'),
    ]);

    const result = await runStrategySearch({
      source: source as never,
      logger: LOGGER as never,
      strategy: STRATEGY as never,
      searchType: 'sales_navigator',
      searchCategory: 'people',
      parameterKey: 'salesNavigatorPeopleSearch',
      apiToken: 'token',
      executionOptions: OPTIONS,
      stream: {},
    });

    expect(result).toMatchObject({
      itemCount: 2,
      error: {
        message: 'rate limited',
        details: 'Stopped after page 1. rate limited',
      },
    });
  });

  it('should return nothing for a strategy without parameters', async () => {
    const { source, fetchPage } = createSource([page(['a'])]);

    const result = await runUnvalidated(source, {
      strategy: { id: 'empty' },
    });

    expect(result).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('should review each page and stop when the review says so', async () => {
    const { source, fetchPage } = createSource([
      page(['a', 'b'], { cursor: 'c1' }),
      page(['c', 'd'], { cursor: 'c2' }),
    ]);
    const resultValidationService = {
      validateResultsAgainstQuery: jest.fn(async () => ({
        qualityAssessment: 'low',
        relevanceScore: 0.2,
        reasoning: 'off target',
      })),
      shouldContinuePagination: jest.fn(() => false),
    };
    const sendEvent = jest.fn(
      (_event: string, _data?: { message?: string }) => true,
    );

    const result = await runStrategySearch({
      source: source as never,
      logger: LOGGER as never,
      strategy: STRATEGY as never,
      searchType: 'sales_navigator',
      searchCategory: 'people',
      parameterKey: 'salesNavigatorPeopleSearch',
      apiToken: 'token',
      sendEvent,
      executionOptions: OPTIONS,
      stream: {
        review: {
          userMessage: 'CFOs in Mumbai',
          resultValidationService: resultValidationService as never,
        },
      },
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(
      resultValidationService.validateResultsAgainstQuery,
    ).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      itemCount: 2,
      validationResults: [{ page: 1 }],
    });
    expect(result?.streamTableId).toEqual(expect.any(String));
    expect(sendEvent.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining(['validation', 'candidateBatch', 'table_data']),
    );
  });
});

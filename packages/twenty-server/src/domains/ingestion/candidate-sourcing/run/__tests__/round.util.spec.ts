import {
  canFetchMore,
  runFetchRound,
  type FetchedPage,
} from 'src/domains/ingestion/candidate-sourcing/run/round.util';

type Row = { id: string };

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));

const source = (pages: Array<FetchedPage<Row> | null | Error>) => {
  const fetchPage = jest.fn(async ({ page }: { page: number }) => {
    const result = pages[page - 1] ?? null;

    if (result instanceof Error) {
      throw result;
    }

    return result;
  });

  return fetchPage;
};

const run = (
  pages: Array<FetchedPage<Row> | null | Error>,
  overrides: Partial<Parameters<typeof runFetchRound<Row>>[0]> = {},
) =>
  runFetchRound<Row>({
    fetchPage: source(pages),
    keyOf: (row) => row.id,
    pageSize: 2,
    maxPages: 10,
    ...overrides,
  });

describe('runFetchRound', () => {
  it('should page until the source has no more pages', async () => {
    const result = await run([
      { items: rows('a', 'b'), hasMore: true, cursor: 'c1' },
      { items: rows('c'), hasMore: false },
    ]);

    expect(result).toMatchObject({
      items: rows('a', 'b', 'c'),
      pages: 2,
      fetched: 3,
      duplicates: 0,
      stoppedBecause: 'no_more_pages',
    });
  });

  it('should hand the cursor of one page to the next', async () => {
    const fetchPage = source([
      { items: rows('a', 'b'), hasMore: true, cursor: 'c1' },
      { items: rows('c'), hasMore: false },
    ]);

    await run([], { fetchPage });

    expect(fetchPage.mock.calls.map(([request]) => request)).toEqual([
      { page: 1, cursor: undefined },
      { page: 2, cursor: 'c1' },
    ]);
  });

  it('should stop on an empty page', async () => {
    const result = await run([
      { items: rows('a'), hasMore: true },
      { items: [], hasMore: true },
    ]);

    expect(result).toMatchObject({ pages: 1, stoppedBecause: 'empty_page' });
  });

  it('should stop when a page holds only rows it already has', async () => {
    const result = await run([
      { items: rows('a', 'b'), hasMore: true },
      { items: rows('b', 'a'), hasMore: true },
      { items: rows('z'), hasMore: true },
    ]);

    expect(result).toMatchObject({
      items: rows('a', 'b'),
      fetched: 4,
      duplicates: 2,
      stoppedBecause: 'duplicates_only',
    });
  });

  it('should stop at the last page the count implies', async () => {
    const fetchPage = source([
      { items: rows('a', 'b'), counts: 4, hasMore: true },
      { items: rows('c', 'd'), hasMore: true },
      { items: rows('e'), hasMore: true },
    ]);
    const result = await run([], { fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      counts: 4,
      totalPages: 2,
      stoppedBecause: 'last_page',
    });
  });

  it('should ignore a count the source does not report', async () => {
    const result = await run([
      { items: rows('a', 'b'), hasMore: true },
      { items: rows('c', 'd'), hasMore: true },
      { items: rows('e'), hasMore: false },
    ]);

    expect(result).toMatchObject({ counts: undefined, pages: 3 });
  });

  it('should stop at maxRows and at maxPages, and say more can be fetched', async () => {
    const pages = [
      { items: rows('a', 'b'), hasMore: true },
      { items: rows('c', 'd'), hasMore: true },
      { items: rows('e', 'f'), hasMore: true },
    ];

    const byRows = await run(pages, { maxRows: 3 });
    const byPages = await run(pages, { maxPages: 1 });

    expect(byRows).toMatchObject({ pages: 2, stoppedBecause: 'max_rows' });
    expect(byPages).toMatchObject({ pages: 1, stoppedBecause: 'max_pages' });
    expect(canFetchMore(byRows.stoppedBecause)).toBe(true);
    expect(canFetchMore('no_more_pages')).toBe(false);
    expect(canFetchMore('duplicates_only')).toBe(false);
  });

  it('should end the round when the caller declines the next page', async () => {
    const shouldContinue = jest.fn(async () => false);
    const result = await run(
      [
        { items: rows('a'), hasMore: true },
        { items: rows('b'), hasMore: true },
      ],
      { shouldContinue },
    );

    expect(shouldContinue).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ pages: 1, stoppedBecause: 'declined' });
  });

  it('should stop before fetching when aborted', async () => {
    const fetchPage = source([{ items: rows('a'), hasMore: true }]);
    const result = await run([], { fetchPage, isAborted: () => true });

    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.stoppedBecause).toBe('aborted');
  });

  it('should keep collected rows when a later page fails, if asked to', async () => {
    const failure = new Error('upstream');
    const pages = [{ items: rows('a'), hasMore: true }, failure];

    const kept = await run(pages, { keepRowsOnError: true });

    expect(kept).toMatchObject({
      items: rows('a'),
      stoppedBecause: 'error',
      error: failure,
    });
    await expect(run(pages)).rejects.toThrow('upstream');
  });

  it('should report each page with the rows that were new', async () => {
    const onPage = jest.fn();

    await run(
      [
        { items: rows('a', 'b'), hasMore: true },
        { items: rows('b', 'c'), hasMore: false },
      ],
      { onPage },
    );

    expect(onPage.mock.calls[1][0]).toMatchObject({
      page: 2,
      newItems: rows('c'),
      newIndexes: [1],
      totalItems: 3,
    });
  });

  it('should pace between pages but not after the last', async () => {
    const betweenPages = jest.fn(async () => undefined);

    await run(
      [
        { items: rows('a'), hasMore: true },
        { items: rows('b'), hasMore: false },
      ],
      { betweenPages },
    );

    expect(betweenPages.mock.calls).toEqual([[2]]);
  });
});

import { collectLinkedinSearchPages } from '../collect-linkedin-search-pages';

const page = (items: number, cursor?: string, wrapped = false) => {
  const root = {
    items: Array.from({ length: items }, (_, index) => ({ id: index })),
    ...(cursor !== undefined ? { cursor } : {}),
    config: { params: { keywords: 'plant head' } },
  };

  return wrapped ? { result: root } : root;
};

describe('collectLinkedinSearchPages', () => {
  it('should follow the cursor and return one merged response', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(25, 'c2'))
      .mockResolvedValueOnce(page(25, 'c3'))
      .mockResolvedValueOnce(page(10));
    const result = await collectLinkedinSearchPages({
      firstCursor: 'c1',
      fetchPage,
      maxPages: 10,
    });

    expect(fetchPage.mock.calls.map((call) => call[0])).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
    expect(result).toMatchObject({
      pages: 3,
      rows: 60,
      stoppedBecause: 'no_more_pages',
    });

    const response = result.response as {
      items: unknown[];
      cursor?: string;
      config: unknown;
      autoContinue: { pages: number };
    };

    expect(response.items).toHaveLength(60);
    expect(response.cursor).toBeUndefined();
    expect(response.config).toBeDefined();
    expect(response.autoContinue.pages).toBe(3);
  });

  it('should stop at the page limit and keep the cursor to carry on from', async () => {
    const fetchPage = jest
      .fn()
      .mockImplementation(async (cursor: string) =>
        page(25, `after-${cursor}`),
      );
    const result = await collectLinkedinSearchPages({
      firstCursor: 'c1',
      fetchPage,
      maxPages: 3,
    });
    const response = result.response as { cursor: string };

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.stoppedBecause).toBe('page_limit');
    expect(response.cursor).toBe('after-after-after-c1');
  });

  it('should stop when enough rows are collected', async () => {
    const fetchPage = jest
      .fn()
      .mockImplementation(async () => page(25, 'next'));
    const result = await collectLinkedinSearchPages({
      firstCursor: 'c1',
      fetchPage,
      maxPages: 50,
      maxRows: 60,
    });

    expect(result.rows).toBe(75);
    expect(result.stoppedBecause).toBe('row_limit');
  });

  it('should stop on an empty page', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(25, 'c2'))
      .mockResolvedValueOnce(page(0, 'c3'));
    const result = await collectLinkedinSearchPages({
      firstCursor: 'c1',
      fetchPage,
      maxPages: 50,
    });

    expect(result.stoppedBecause).toBe('empty_page');
    expect(result.rows).toBe(25);
  });

  it('should keep what it read when a later page fails', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(25, 'c2'))
      .mockRejectedValueOnce(new Error('429 rate limited'));
    const result = await collectLinkedinSearchPages({
      firstCursor: 'c1',
      fetchPage,
      maxPages: 50,
    });
    const response = result.response as {
      cursor: string;
      autoContinue: { error: string };
    };

    expect(result).toMatchObject({
      pages: 1,
      rows: 25,
      stoppedBecause: 'error',
    });
    expect(response.cursor).toBe('c2');
    expect(response.autoContinue.error).toContain('429');
  });

  it('should rethrow when the first page fails', async () => {
    await expect(
      collectLinkedinSearchPages({
        firstCursor: 'c1',
        fetchPage: jest.fn().mockRejectedValue(new Error('boom')),
        maxPages: 5,
      }),
    ).rejects.toThrow('boom');
  });

  it('should keep a result wrapper around the merged page', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(25, 'c2', true))
      .mockResolvedValueOnce(page(5, undefined, true));
    const result = await collectLinkedinSearchPages({
      firstCursor: 'c1',
      fetchPage,
      maxPages: 5,
    });
    const response = result.response as { result: { items: unknown[] } };

    expect(response.result.items).toHaveLength(30);
  });

  it('should never read more than 50 pages', async () => {
    const fetchPage = jest.fn().mockImplementation(async () => page(1, 'next'));

    await collectLinkedinSearchPages({
      firstCursor: 'c1',
      fetchPage,
      maxPages: 500,
      maxRows: 100000,
    });

    expect(fetchPage).toHaveBeenCalledTimes(50);
  });
});

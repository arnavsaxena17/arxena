import { UnipileSearchResultsCacheService } from '../unipile-search-results-cache.service';
import type { LinkedInSearchResponse } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

const emptyResponse = (id: string): LinkedInSearchResponse => ({
  object: 'LinkedinSearch',
  items: [{ object: 'SearchResult', type: 'PEOPLE', id } as never],
  config: { params: {} },
  paging: { start: 0, page_count: 1, total_count: 1 },
  cursor: null,
});

describe('UnipileSearchResultsCacheService', () => {
  const store = new Map<string, LinkedInSearchResponse>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: LinkedInSearchResponse) => {
      store.set(key, value);
    }),
  };
  const input = {
    accountId: 'acct-1',
    searchRequest: {
      api: 'sales_navigator',
      category: 'people',
      keywords: 'CEO',
    },
    limit: 10,
  };

  let service: UnipileSearchResultsCacheService;

  beforeEach(() => {
    store.clear();
    cache.get.mockClear();
    cache.set.mockClear();
    service = new UnipileSearchResultsCacheService(cache as never);
  });

  it('fetches once and returns cached results on the next identical query', async () => {
    const fetcher = jest.fn().mockResolvedValue(emptyResponse('p1'));

    const first = await service.getOrFetch(input, fetcher);
    const second = await service.getOrFetch(input, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.items[0].id).toBe('p1');
    expect(second.items[0].id).toBe('p1');
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('coalesces in-flight identical queries into one Unipile fetch', async () => {
    let resolveFetch: ((value: LinkedInSearchResponse) => void) | undefined;
    let signalStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const fetcher = jest.fn(
      () =>
        new Promise<LinkedInSearchResponse>((resolve) => {
          resolveFetch = resolve;
          signalStarted?.();
        }),
    );

    const first = service.getOrFetch(input, fetcher);
    await started;
    const second = service.getOrFetch(input, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveFetch?.(emptyResponse('p2'));

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.items[0].id).toBe('p2');
    expect(secondResult.items[0].id).toBe('p2');
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed Unipile fetch', async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error('unipile down'))
      .mockResolvedValueOnce(emptyResponse('p3'));

    await expect(service.getOrFetch(input, fetcher)).rejects.toThrow(
      'unipile down',
    );

    const recovered = await service.getOrFetch(input, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(recovered.items[0].id).toBe('p3');
  });
});

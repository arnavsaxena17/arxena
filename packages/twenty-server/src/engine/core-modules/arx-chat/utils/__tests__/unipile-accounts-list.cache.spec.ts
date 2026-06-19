import {
    fetchUnipileAccountsListWithCache,
    getCachedUnipileAccountsList,
    invalidateUnipileAccountsListCache,
    shouldInvalidateUnipileAccountsListCache,
} from '../unipile-accounts-list.cache';

describe('unipile-accounts-list.cache', () => {
  beforeEach(() => {
    invalidateUnipileAccountsListCache();
  });

  it('shouldInvalidateUnipileAccountsListCache returns true for account mutations', () => {
    console.log('testing invalidate rules for POST /accounts');
    expect(
      shouldInvalidateUnipileAccountsListCache('/api/v1/accounts', 'POST'),
    ).toBe(true);
    console.log('testing invalidate rules for DELETE /accounts/:id');
    expect(
      shouldInvalidateUnipileAccountsListCache(
        '/api/v1/accounts/abc',
        'DELETE',
      ),
    ).toBe(true);
    console.log('testing invalidate rules for GET /accounts');
    expect(
      shouldInvalidateUnipileAccountsListCache('/api/v1/accounts', 'GET'),
    ).toBe(false);
  });

  it('fetchUnipileAccountsListWithCache coalesces concurrent fetches', async () => {
    let fetchCount = 0;
    const fetcher = jest.fn(async () => {
      fetchCount += 1;
      await Promise.resolve();
      return { items: [{ id: 'acc-1', type: 'LINKEDIN' }] };
    });

    console.log('starting parallel cached fetches');
    const [first, second] = await Promise.all([
      fetchUnipileAccountsListWithCache(fetcher),
      fetchUnipileAccountsListWithCache(fetcher),
    ]);

    expect(fetchCount).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(getCachedUnipileAccountsList()).toEqual(first);
    console.log('parallel cached fetches completed with single upstream call');
  });

  it('invalidateUnipileAccountsListCache forces a refetch', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'acc-1' }] })
      .mockResolvedValueOnce({ items: [{ id: 'acc-2' }] });

    console.log('first fetch populates cache');
    const first = await fetchUnipileAccountsListWithCache(fetcher);
    expect(first.items?.[0]?.id).toBe('acc-1');

    invalidateUnipileAccountsListCache();
    console.log('second fetch after invalidation');
    const second = await fetchUnipileAccountsListWithCache(fetcher);
    expect(second.items?.[0]?.id).toBe('acc-2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

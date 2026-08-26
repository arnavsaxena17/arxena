import {
  UNIPILE_SEARCH_RESULTS_CACHE_KEY_PREFIX,
  buildUnipileSearchResultsCacheKey,
} from '../unipile-search-results-cache-key.util';

describe('buildUnipileSearchResultsCacheKey', () => {
  const searchRequest = {
    api: 'sales_navigator',
    category: 'people',
    keywords: 'CEO',
    company: { include: ['1642'] },
  };

  it('is stable across object key order', () => {
    const first = buildUnipileSearchResultsCacheKey({
      accountId: 'acct-1',
      searchRequest,
      limit: 10,
    });
    const second = buildUnipileSearchResultsCacheKey({
      accountId: 'acct-1',
      searchRequest: {
        company: { include: ['1642'] },
        keywords: 'CEO',
        category: 'people',
        api: 'sales_navigator',
      },
      limit: 10,
    });

    expect(first).toBe(second);
    expect(first.startsWith(`${UNIPILE_SEARCH_RESULTS_CACHE_KEY_PREFIX}:acct-1:`)).toBe(
      true,
    );
  });

  it('changes when account, limit, cursor, or query change', () => {
    const base = buildUnipileSearchResultsCacheKey({
      accountId: 'acct-1',
      searchRequest,
      limit: 10,
    });

    expect(
      buildUnipileSearchResultsCacheKey({
        accountId: 'acct-2',
        searchRequest,
        limit: 10,
      }),
    ).not.toBe(base);
    expect(
      buildUnipileSearchResultsCacheKey({
        accountId: 'acct-1',
        searchRequest,
        limit: 25,
      }),
    ).not.toBe(base);
    expect(
      buildUnipileSearchResultsCacheKey({
        accountId: 'acct-1',
        searchRequest,
        limit: 10,
        cursor: 'next-page',
      }),
    ).not.toBe(base);
    expect(
      buildUnipileSearchResultsCacheKey({
        accountId: 'acct-1',
        searchRequest: { ...searchRequest, keywords: 'CTO' },
        limit: 10,
      }),
    ).not.toBe(base);
  });
});

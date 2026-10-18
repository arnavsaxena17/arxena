import {
  COMPANY_NEWS_ITEM_MAX_AGE_MS,
  filterRecentCompanyNewsItems,
  isRecentCompanyNewsItem,
  parseCompanyNewsItemDateMs,
} from 'src/engine/core-modules/org-chart/utils/filter-recent-company-news-items.util';

describe('parseCompanyNewsItemDateMs', () => {
  const nowMs = Date.parse('2026-10-16T12:00:00.000Z');

  it('parses relative SERP ages', () => {
    expect(parseCompanyNewsItemDateMs('2 hours ago', nowMs)).toBe(
      nowMs - 2 * 60 * 60 * 1000,
    );
    expect(parseCompanyNewsItemDateMs('3 days ago', nowMs)).toBe(
      nowMs - 3 * 24 * 60 * 60 * 1000,
    );
  });

  it('parses ISO dates and rejects unknown', () => {
    expect(parseCompanyNewsItemDateMs('2026-09-01T00:00:00.000Z', nowMs)).toBe(
      Date.parse('2026-09-01T00:00:00.000Z'),
    );
    expect(parseCompanyNewsItemDateMs('unknown', nowMs)).toBeNull();
    expect(parseCompanyNewsItemDateMs('', nowMs)).toBeNull();
  });
});

describe('filterRecentCompanyNewsItems', () => {
  const nowMs = Date.parse('2026-10-16T12:00:00.000Z');

  it('keeps only items within the max age window', () => {
    const recent = { date: '2 weeks ago', summary: 'new', url: 'https://a' };
    const stale = {
      date: new Date(
        nowMs - COMPANY_NEWS_ITEM_MAX_AGE_MS - 86_400_000,
      ).toISOString(),
      summary: 'old',
      url: 'https://b',
    };
    const unknown = { date: 'unknown', summary: 'maybe', url: 'https://c' };

    expect(
      filterRecentCompanyNewsItems([recent, stale, unknown], { nowMs }),
    ).toEqual([recent]);
    expect(isRecentCompanyNewsItem(stale, { nowMs })).toBe(false);
  });
});

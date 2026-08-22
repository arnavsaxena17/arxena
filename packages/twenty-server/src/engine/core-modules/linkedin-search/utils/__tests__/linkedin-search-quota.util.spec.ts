import {
  isLinkedInSearchCursorRequest,
  shouldCountLinkedInSearchQuota,
} from 'src/engine/core-modules/linkedin-search/utils/linkedin-search-quota.util';

describe('shouldCountLinkedInSearchQuota', () => {
  it('counts the first page of a search', () => {
    expect(shouldCountLinkedInSearchQuota({})).toBe(true);
    expect(shouldCountLinkedInSearchQuota({ start: 0, offset: 0 })).toBe(true);
  });

  it('does not count cursor, start, or offset pagination', () => {
    expect(
      shouldCountLinkedInSearchQuota({ cursor: 'next-page-token' }),
    ).toBe(false);
    expect(shouldCountLinkedInSearchQuota({ start: 25 })).toBe(false);
    expect(shouldCountLinkedInSearchQuota({ offset: 50 })).toBe(false);
  });

  it('can be skipped explicitly', () => {
    expect(shouldCountLinkedInSearchQuota({ countSearchQuota: false })).toBe(
      false,
    );
  });
});

describe('isLinkedInSearchCursorRequest', () => {
  it('detects Unipile cursor-only continuation bodies', () => {
    expect(isLinkedInSearchCursorRequest({ cursor: 'abc' })).toBe(true);
    expect(
      isLinkedInSearchCursorRequest({
        api: 'sales_navigator',
        category: 'people',
        cursor: 'abc',
      }),
    ).toBe(false);
    expect(isLinkedInSearchCursorRequest({ url: 'https://linkedin.com' })).toBe(
      false,
    );
  });
});

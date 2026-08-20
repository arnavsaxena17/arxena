import {
  isUnipileAccountListV2Enabled,
  normalizeSalesNavigatorAccountListSortBy,
  toUnipileV2AccountListId,
} from '../sales-navigator-account-list-sort.util';

describe('sales-navigator-account-list-sort.util', () => {
  const original = process.env.UNIPILE_ACCOUNT_LIST_V2;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.UNIPILE_ACCOUNT_LIST_V2;
    } else {
      process.env.UNIPILE_ACCOUNT_LIST_V2 = original;
    }
  });

  it('prefixes numeric list ids for Unipile v2', () => {
    expect(toUnipileV2AccountListId('7378394885466337283')).toBe(
      'ACCOUNT_7378394885466337283',
    );
    expect(toUnipileV2AccountListId('ACCOUNT_7378394885466337283')).toBe(
      'ACCOUNT_7378394885466337283',
    );
  });

  it('maps date aliases to DATE_ADDED', () => {
    expect(normalizeSalesNavigatorAccountListSortBy('timestamp')).toBe(
      'DATE_ADDED',
    );
    expect(normalizeSalesNavigatorAccountListSortBy('datetime')).toBe(
      'DATE_ADDED',
    );
  });

  it('prefers the request flag over the env default', () => {
    process.env.UNIPILE_ACCOUNT_LIST_V2 = 'true';
    expect(isUnipileAccountListV2Enabled(false)).toBe(false);
    process.env.UNIPILE_ACCOUNT_LIST_V2 = 'false';
    expect(isUnipileAccountListV2Enabled(true)).toBe(true);
    expect(isUnipileAccountListV2Enabled(undefined)).toBe(false);
    process.env.UNIPILE_ACCOUNT_LIST_V2 = 'true';
    expect(isUnipileAccountListV2Enabled(undefined)).toBe(true);
  });
});

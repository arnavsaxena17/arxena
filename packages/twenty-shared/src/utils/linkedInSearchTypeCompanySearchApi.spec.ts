import {
    isLikelyLinkedInSearchTypeMismatchError,
    linkedInSearchTypeToCompanySearchApi,
} from './linkedInSearchTypeCompanySearchApi';

describe('linkedInSearchTypeToCompanySearchApi', () => {
  it('maps sales_navigator to sales_navigator company API', () => {
    expect(linkedInSearchTypeToCompanySearchApi('sales_navigator')).toBe(
      'sales_navigator',
    );
  });

  it('maps classic and recruiter to classic company API', () => {
    expect(linkedInSearchTypeToCompanySearchApi('classic')).toBe('classic');
    expect(linkedInSearchTypeToCompanySearchApi('recruiter')).toBe('classic');
  });
});

describe('isLikelyLinkedInSearchTypeMismatchError', () => {
  it('detects sales navigator subscription errors', () => {
    expect(
      isLikelyLinkedInSearchTypeMismatchError(
        new Error('Sales Navigator subscription required'),
      ),
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isLikelyLinkedInSearchTypeMismatchError(new Error('timeout'))).toBe(
      false,
    );
  });
});

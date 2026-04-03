import { mergeBusinessDivisionFilters } from './business-division-merge.util';

describe('mergeBusinessDivisionFilters', () => {
  it('prefers parsed country and function over UI defaults', () => {
    // eslint-disable-next-line no-console
    console.log('mergeBusinessDivisionFilters: test prefers parsed over defaults');
    const merged = mergeBusinessDivisionFilters(
      {
        linkedin_keywords: 'textile',
        country: 'India',
        function_root: 'engineering',
        rationale: undefined,
      },
      'global',
      'sales',
    );
    expect(merged.linkedinKeywords).toBe('textile');
    expect(merged.effectiveCountryRaw).toBe('India');
    expect(merged.effectiveFunctionRoot).toBe('engineering');
    // eslint-disable-next-line no-console
    console.log('mergeBusinessDivisionFilters: merged', merged);
  });

  it('falls back to UI defaults when parsed fields are null', () => {
    // eslint-disable-next-line no-console
    console.log('mergeBusinessDivisionFilters: test falls back to UI defaults');
    const merged = mergeBusinessDivisionFilters(
      {
        linkedin_keywords: 'PU OR polyurethane',
        country: null,
        function_root: null,
        rationale: undefined,
      },
      'Germany',
      'Full Company',
    );
    expect(merged.effectiveCountryRaw).toBe('Germany');
    expect(merged.effectiveFunctionRoot).toBe('');
    // eslint-disable-next-line no-console
    console.log('mergeBusinessDivisionFilters: merged', merged);
  });
});

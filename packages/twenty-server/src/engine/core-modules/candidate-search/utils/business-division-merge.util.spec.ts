import { mergeFilters } from './org-chart-filters-merge.util';

describe('mergeFilters', () => {
  it('prefers parsed country and function over UI defaults', () => {
    // eslint-disable-next-line no-console
    console.log('mergeFilters: test prefers parsed over defaults');
    const merged = mergeFilters(
      {
        business_division_keywords: 'textile',
        country: 'India',
        business_division: null,
        role_description: null,
        std_grade_levels: null,
        function_root: 'engineering',
        rationale: null,
      },
      'global',
      'sales',
    );
    expect(merged.businessDivisionKeywords).toBe('textile');
    expect(merged.effectiveCountryRaw).toBe('India');
    expect(merged.effectiveFunctionRoot).toBe('engineering');
    // eslint-disable-next-line no-console
    console.log('mergeFilters: merged', merged);
  });

  it('falls back to UI defaults when parsed fields are null', () => {
    // eslint-disable-next-line no-console
    console.log('mergeFilters: test falls back to UI defaults');
    const merged = mergeFilters(
      {
        business_division_keywords: 'PU OR polyurethane',
        country: null,
        business_division: null,
        role_description: null,
        std_grade_levels: null,
        function_root: null,
        rationale: null,
      },
      'Germany',
      'Full Company',
    );
    expect(merged.effectiveCountryRaw).toBe('Germany');
    expect(merged.effectiveFunctionRoot).toBe('');
    // eslint-disable-next-line no-console
    console.log('mergeFilters: merged', merged);
  });
});

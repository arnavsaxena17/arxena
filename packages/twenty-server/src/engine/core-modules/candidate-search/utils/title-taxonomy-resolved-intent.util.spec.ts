import { buildTitleTaxonomyResolvedIntent } from './title-taxonomy-resolved-intent.util';

describe('buildTitleTaxonomyResolvedIntent', () => {
  it('division-only full company: no role_description fallback, no grade expansion, no BS merge', () => {
    // eslint-disable-next-line no-console
    console.log(
      'buildTitleTaxonomyResolvedIntent: division-only full company',
    );
    const intent = buildTitleTaxonomyResolvedIntent({
      companyName: 'acme',
      parsed: {
        business_division_keywords: 'textile',
        country: null,
        business_division: 'textile',
        role_description: null,
        std_grade_levels: null,
        function_root: null,
        rationale: null,
      },
      effectiveFunctionRoot: 'fullcompany',
    });
    expect(intent.role_description).toBeUndefined();
    expect(intent.division_or_department).toBeUndefined();
    expect(intent.std_grade_levels).toEqual([]);
    expect(intent.merge_boolean_standardize_for_grades).toBe(false);
    expect(intent.merge_boolean_standardize_for_functions).toBe(false);
    expect(intent.std_function_roots).toBeUndefined();
    // eslint-disable-next-line no-console
    console.log('buildTitleTaxonomyResolvedIntent: intent', intent);
  });

  it('function root from UI: grade list empty unless LLM set std_grade_levels; function merge on when role present', () => {
    // eslint-disable-next-line no-console
    console.log('buildTitleTaxonomyResolvedIntent: UI function root + role');
    const intent = buildTitleTaxonomyResolvedIntent({
      companyName: 'acme',
      parsed: {
        business_division_keywords: 'x',
        country: null,
        business_division: null,
        role_description: 'plant engineer',
        std_grade_levels: null,
        function_root: null,
        rationale: null,
      },
      effectiveFunctionRoot: 'engineering',
    });
    expect(intent.std_function_roots).toEqual(['engineering']);
    expect(intent.std_grade_levels).toEqual([]);
    expect(intent.merge_boolean_standardize_for_functions).toBe(true);
    expect(intent.role_description).toBe('plant engineer');
    // eslint-disable-next-line no-console
    console.log('buildTitleTaxonomyResolvedIntent: intent', intent);
  });

  it('explicit std_grade_levels without function or role: grade-only — no function roots, no function BS merge', () => {
    // eslint-disable-next-line no-console
    console.log('buildTitleTaxonomyResolvedIntent: grade-only');
    const intent = buildTitleTaxonomyResolvedIntent({
      companyName: 'acme',
      parsed: {
        business_division_keywords: 'x',
        country: null,
        business_division: null,
        role_description: null,
        std_grade_levels: ['leadership'],
        function_root: null,
        rationale: null,
      },
      effectiveFunctionRoot: 'fullcompany',
    });
    expect(intent.std_grade_levels).toEqual(['leadership']);
    expect(intent.merge_boolean_standardize_for_functions).toBe(false);
    expect(intent.std_function_roots).toBeUndefined();
    // eslint-disable-next-line no-console
    console.log('buildTitleTaxonomyResolvedIntent: intent', intent);
  });

  it('explicit grades plus role text: not grade-only; BS function merge stays on', () => {
    // eslint-disable-next-line no-console
    console.log('buildTitleTaxonomyResolvedIntent: grades + role');
    const intent = buildTitleTaxonomyResolvedIntent({
      companyName: 'acme',
      parsed: {
        business_division_keywords: 'x',
        country: null,
        business_division: null,
        role_description: 'senior engineer',
        std_grade_levels: ['mid'],
        function_root: null,
        rationale: null,
      },
      effectiveFunctionRoot: 'fullcompany',
    });
    expect(intent.merge_boolean_standardize_for_functions).toBe(true);
    expect(intent.std_grade_levels).toEqual(['mid']);
    // eslint-disable-next-line no-console
    console.log('buildTitleTaxonomyResolvedIntent: intent', intent);
  });
});

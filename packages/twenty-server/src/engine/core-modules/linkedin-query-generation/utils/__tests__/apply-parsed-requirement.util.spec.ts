import {
  applyParsedRequirementToQuerySet,
  applyRequirementToQuery,
  toLinkedInCompanyType,
} from 'src/engine/core-modules/linkedin-query-generation/utils/apply-parsed-requirement.util';
import type {
  ParsedRequirement,
  SearchQuery,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

const requirement = (
  overrides: Partial<ParsedRequirement> = {},
): ParsedRequirement => ({
  original_requirement: 'sales heads at listed pharma companies in mumbai',
  query_type: 'C',
  query_type_description: 'title plus industry',
  domain_expertise: [],
  technical_skills: [],
  industry_terms: ['pharmaceuticals'],
  certifications: ['Six Sigma'],
  target_companies: [],
  company_type: 'listed',
  location: ['Mumbai'],
  precision_vs_recall: 'balanced',
  ...overrides,
});

const query = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({
  keywords: 'sales head',
  job_title: null,
  company: null,
  location: ['Mumbai'],
  years_of_experience: null,
  ...overrides,
});

describe('toLinkedInCompanyType', () => {
  it.each([
    ['listed', 'public_company'],
    ['public company', 'public_company'],
    ['privately held', 'privately_held'],
    ['non-profit', 'non_profit'],
    ['government agency', 'government_agency'],
  ])('should map %s', (raw, expected) => {
    expect(toLinkedInCompanyType(raw)).toBe(expected);
  });

  it('should return undefined for an unknown phrase', () => {
    expect(toLinkedInCompanyType('a co-operative of growers')).toBeUndefined();
  });
});

describe('applyRequirementToQuery', () => {
  it('should fold the stated industry and certifications in as a boolean group', () => {
    const { query: applied } = applyRequirementToQuery(query(), requirement());

    expect(applied.keywords).toBe(
      'sales head AND (pharmaceuticals OR "Six Sigma")',
    );
  });

  it('should never produce a bare append that breaks an existing expression', () => {
    const { query: applied } = applyRequirementToQuery(
      query({ keywords: '(sales OR business) AND (head OR director)' }),
      requirement(),
    );

    expect(applied.keywords).toBe(
      '(sales OR business) AND (head OR director) AND (pharmaceuticals OR "Six Sigma")',
    );
  });

  it('should carry the requirement onto the query rather than drop it', () => {
    const { query: applied } = applyRequirementToQuery(query(), requirement());

    expect(applied.industry_terms).toEqual(['pharmaceuticals']);
    expect(applied.certifications).toEqual(['Six Sigma']);
    expect(applied.company_type).toBe('public_company');
    expect(applied.company_type_raw).toBe('listed');
  });

  it('should not duplicate a term the query already has', () => {
    const { query: applied } = applyRequirementToQuery(
      query({ keywords: 'sales head pharmaceuticals' }),
      requirement(),
    );

    expect(applied.keywords).toBe('sales head pharmaceuticals AND ("Six Sigma")');
  });

  it('should respect the 6-term budget and report what did not fit', () => {
    const crowded = query({ keywords: 'a b c d e f' });
    const { query: applied, dropped } = applyRequirementToQuery(
      crowded,
      requirement(),
    );

    expect(applied.keywords).toBe('a b c d e f');
    expect(dropped).toEqual(['pharmaceuticals', 'Six Sigma']);
  });

  it('should build years_of_experience from the year bounds', () => {
    const { query: applied } = applyRequirementToQuery(
      query(),
      requirement({ years_min: 8, years_max: 12 }),
    );

    expect(applied.years_of_experience).toBe('8-12');
  });

  it('should keep a years value the query already set', () => {
    const { query: applied } = applyRequirementToQuery(
      query({ years_of_experience: '5+' }),
      requirement({ years_min: 8 }),
    );

    expect(applied.years_of_experience).toBe('5+');
  });

  it('should not create keywords from nothing when the requirement is empty', () => {
    const blank = requirement({
      industry_terms: [],
      certifications: [],
      company_type: undefined,
    });
    const { query: applied } = applyRequirementToQuery(
      query({ keywords: null }),
      blank,
    );

    expect(applied.keywords).toBeNull();
  });
});

describe('applyParsedRequirementToQuerySet', () => {
  it('should apply to every query in the set', () => {
    const { querySet } = applyParsedRequirementToQuerySet(
      {
        search_query_set: [
          query({ keywords: 'sales head' }),
          query({ keywords: 'vp sales' }),
        ],
      },
      requirement(),
    );

    expect(querySet.search_query_set.map((one) => one.keywords)).toEqual([
      'sales head AND (pharmaceuticals OR "Six Sigma")',
      'vp sales AND (pharmaceuticals OR "Six Sigma")',
    ]);
  });

  it('should union the dropped terms across the set', () => {
    const { dropped } = applyParsedRequirementToQuerySet(
      {
        search_query_set: [
          query({ keywords: 'a b c d e f' }),
          query({ keywords: 'a b c d e f' }),
        ],
      },
      requirement(),
    );

    expect(dropped).toEqual(['pharmaceuticals', 'Six Sigma']);
  });
});

import { type OrgchartLinkedInRequestOptions } from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';
import {
  deriveOrgchartRequestFilters,
  normalizeOrgchartLinkedInRequest,
} from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-request.util';

const requestOf = (overrides: Partial<OrgchartLinkedInRequestOptions> = {}) =>
  normalizeOrgchartLinkedInRequest({
    companyName: 'Acme',
    mode: 'entire_company',
    ...overrides,
  });

const filtersOf = (
  request: ReturnType<typeof requestOf>,
  overrides: Partial<Parameters<typeof deriveOrgchartRequestFilters>[1]> = {},
) =>
  deriveOrgchartRequestFilters(request, {
    searchType: 'classic',
    country: request.country,
    functionRoot: request.functionRoot,
    ...overrides,
  });

describe('normalizeOrgchartLinkedInRequest', () => {
  it('should default every field when the request says nothing', () => {
    expect(normalizeOrgchartLinkedInRequest(undefined)).toEqual({
      mode: undefined,
      primaryCompanyName: '',
      primaryCompanyId: '',
      companyNames: [],
      rawCountryFromOptions: '',
      rawFunctionFromOptions: '',
      country: '',
      functionRoot: '',
      linkedinLocationId: '',
      linkedinLocationName: '',
      linkedinCompanyParameterIds: [],
      businessDivisionRaw: undefined,
    });
  });

  it('should treat global as no country at all', () => {
    expect(requestOf({ country: 'Global' }).country).toBe('');
  });

  it('should stand the location name in for a missing country', () => {
    expect(requestOf({ linkedinLocationName: 'Mumbai' }).country).toBe(
      'Mumbai',
    );
  });

  it('should keep a given country over the location name', () => {
    const request = requestOf({
      country: 'India',
      linkedinLocationName: 'Mumbai',
    });

    expect(request.country).toBe('India');
    expect(request.rawCountryFromOptions).toBe('India');
  });

  it('should prefer the company id list over the single id', () => {
    expect(
      requestOf({
        linkedinCompanyParameterId: 'single',
        linkedinCompanyParameterIds: ['first', 'second'],
      }).linkedinCompanyParameterIds,
    ).toEqual(['first', 'second']);
  });

  it('should fall back to the single company id and drop empty ids', () => {
    expect(
      requestOf({ linkedinCompanyParameterId: ' single ' })
        .linkedinCompanyParameterIds,
    ).toEqual(['single']);
    expect(
      requestOf({ linkedinCompanyParameterIds: ['ok', '  '] })
        .linkedinCompanyParameterIds,
    ).toEqual(['ok']);
  });

  it('should trim the names it keeps', () => {
    const request = requestOf({
      companyName: '  Acme  ',
      companyId: ' acme ',
      companyNames: [' Acme ', '', 'Beta'],
      functionRoot: ' Sales ',
      businessDivisionRawQuery: ' the sales org ',
    });

    expect(request.primaryCompanyName).toBe('Acme');
    expect(request.primaryCompanyId).toBe('acme');
    expect(request.companyNames).toEqual(['Acme', 'Beta']);
    expect(request.rawFunctionFromOptions).toBe('Sales');
    expect(request.businessDivisionRaw).toBe('the sales org');
  });
});

describe('deriveOrgchartRequestFilters', () => {
  it('should call an unfiltered classic entire-company search all-people', () => {
    expect(filtersOf(requestOf())).toEqual({
      hasAdditionalFilters: false,
      hasSubsetScopeFilters: false,
      isAllPeopleInCompanyMode: true,
    });
  });

  it('should not call a search all-people once a country narrows it', () => {
    const filters = filtersOf(requestOf({ country: 'India' }));

    expect(filters.hasAdditionalFilters).toBe(true);
    expect(filters.hasSubsetScopeFilters).toBe(true);
    expect(filters.isAllPeopleInCompanyMode).toBe(false);
  });

  it('should count a LinkedIn location id as narrowing the search', () => {
    expect(
      filtersOf(requestOf({ linkedinLocationId: 'loc-1' }))
        .isAllPeopleInCompanyMode,
    ).toBe(false);
  });

  it('should count a leadership-only filter as narrowing the search', () => {
    expect(
      filtersOf(requestOf(), { leadershipOnly: true }).isAllPeopleInCompanyMode,
    ).toBe(false);
  });

  it('should not call a business-division request all-people', () => {
    expect(
      filtersOf(requestOf({ businessDivisionRawQuery: 'the sales org' }))
        .isAllPeopleInCompanyMode,
    ).toBe(false);
  });

  it('should not call anything all-people outside a classic search', () => {
    expect(
      filtersOf(requestOf(), { searchType: 'sales_navigator' })
        .isAllPeopleInCompanyMode,
    ).toBe(false);
  });

  it('should not call a narrowed mode all-people', () => {
    expect(
      filtersOf(requestOf({ mode: 'function_grade' })).isAllPeopleInCompanyMode,
    ).toBe(false);
  });

  it('should read the filters after the business-division step, not before', () => {
    // The request had no country; the business division narrowed it
    const request = requestOf({ businessDivisionRawQuery: 'the sales org' });

    expect(request.country).toBe('');
    expect(filtersOf(request, { country: 'India' }).hasSubsetScopeFilters).toBe(
      true,
    );
  });
});

import {
  buildBrightDataCellQueries,
  buildHarvestCellParameters,
  buildSerpCellQueries,
  countryCodeFor,
  harvestParametersHaveCompany,
  identityCountryCodes,
  titleClauseFor,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/search-params.util';
import { type CompanyIdentity } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-identity.util';

const identity = (overrides: Partial<CompanyIdentity> = {}): CompanyIdentity => ({
  canonicalName: 'Jubilant FoodWorks',
  aliases: ['Jubilant FoodWorks', 'Jubilant FoodWorks Ltd.'],
  resolved: true,
  ...overrides,
});

describe('titleClauseFor', () => {
  it('should use the curated boolean when it fits Google', () => {
    expect(
      titleClauseFor({
        key: 'procurement',
        roles: ['Procurement Head'],
        titles: ['procurement head'],
        titleExpression: '("procurement" AND ("head" OR "director"))',
      }),
    ).toBe('("procurement" ("head" OR "director"))');
  });

  it('should fall back to a quoted OR group when there is no expression', () => {
    expect(
      titleClauseFor({
        key: 'supply',
        roles: ['Supply Chain Head'],
        titles: ['Supply Chain Head', 'VP Supply Chain'],
        titleExpression: null,
      }),
    ).toBe('("Supply Chain Head" OR "VP Supply Chain")');
  });

  it('should return null when there is nothing to ask for', () => {
    expect(
      titleClauseFor({
        key: 'empty',
        roles: [],
        titles: [],
        titleExpression: null,
      }),
    ).toBeNull();
  });
});

describe('buildSerpCellQueries', () => {
  it('should send a plain query and a LinkedIn boolean for the same cell', () => {
    const queries = buildSerpCellQueries({
      identity: identity(),
      cell: {
        key: 'procurement',
        roles: ['Procurement Head'],
        titles: ['procurement head'],
        titleExpression: null,
      },
      location: 'Mumbai',
    });

    expect(queries.plain).toBe('Jubilant FoodWorks procurement head Mumbai');
    expect(queries.boolean).toBe(
      'site:linkedin.com/in "Jubilant FoodWorks" ("procurement head") Mumbai',
    );
  });

  it('should keep the location out of a query that has none', () => {
    const queries = buildSerpCellQueries({
      identity: identity(),
      cell: {
        key: 'ceo',
        roles: ['CEO'],
        titles: ['chief executive'],
        titleExpression: null,
      },
    });

    expect(queries.plain).toBe('Jubilant FoodWorks chief executive');
    expect(queries.boolean).toBe(
      'site:linkedin.com/in "Jubilant FoodWorks" ("chief executive")',
    );
  });
});

describe('buildBrightDataCellQueries', () => {
  it('should keep the sentence free of titles when a boolean owns them', () => {
    const queries = buildBrightDataCellQueries({
      identity: identity(),
      cell: {
        key: 'procurement',
        roles: ['Procurement Head'],
        titles: ['procurement head', 'purchase head'],
        titleExpression: '("procurement" OR "purchase")',
      },
      location: 'India',
    });

    expect(queries.ludicrous).toBe('people at Jubilant FoodWorks India');
    expect(queries.instant).toBe(
      'procurement head purchase head at Jubilant FoodWorks',
    );
  });

  it('should name the titles when there is no boolean', () => {
    const queries = buildBrightDataCellQueries({
      identity: identity(),
      cell: {
        key: 'ceo',
        roles: ['CEO'],
        titles: ['chief executive', 'managing director'],
        titleExpression: null,
      },
    });

    expect(queries.ludicrous).toBe(
      'chief executive, managing director of Jubilant FoodWorks',
    );
  });
});

describe('buildHarvestCellParameters', () => {
  it('should anchor on the company URL and send a flat OR list as titles', () => {
    const parameters = buildHarvestCellParameters({
      identity: identity({ linkedinUrl: 'https://linkedin.com/company/jubilant' }),
      cell: {
        key: 'procurement',
        roles: ['Procurement Head'],
        titles: ['procurement head'],
        titleExpression: 'procurement head OR purchase head',
      },
      location: 'India',
      companyLinkedinUrl: 'https://linkedin.com/company/jubilant',
      functionIds: ['21'],
    });

    expect(parameters).toEqual({
      currentCompanies: 'https://linkedin.com/company/jubilant',
      currentJobTitles: ['procurement head', 'purchase head'],
      locations: 'India',
      functionIds: ['21'],
    });
    expect(harvestParametersHaveCompany(parameters)).toBe(true);
  });

  it('should send a factored boolean on the search field', () => {
    const parameters = buildHarvestCellParameters({
      identity: identity(),
      cell: {
        key: 'procurement',
        roles: ['Procurement Head'],
        titles: [],
        titleExpression: '(procurement OR purchase) AND NOT assistant',
      },
      companyLinkedinUrl: 'https://linkedin.com/company/jubilant',
    });

    expect(parameters.search).toBe(
      '(procurement OR purchase) AND NOT assistant',
    );
    expect(parameters.currentJobTitles).toBeUndefined();
  });

  it('should not claim a company filter when there is no URL', () => {
    const parameters = buildHarvestCellParameters({
      identity: identity(),
      cell: {
        key: 'ceo',
        roles: ['CEO'],
        titles: ['chief executive'],
        titleExpression: null,
      },
    });

    expect(harvestParametersHaveCompany(parameters)).toBe(false);
    expect(parameters.currentCompanies).toBeUndefined();
  });
});

describe('countryCodeFor', () => {
  it('should translate a place the company index returns', () => {
    expect(countryCodeFor('India')).toBe('IN');
    expect(countryCodeFor('Mumbai, India')).toBe('IN');
    expect(countryCodeFor('United Arab Emirates')).toBe('AE');
  });

  it('should pass through a code that is already one', () => {
    expect(countryCodeFor('in')).toBe('IN');
  });

  it('should return nothing for a place it does not know', () => {
    expect(countryCodeFor('Atlantis')).toBeUndefined();
    expect(countryCodeFor(undefined)).toBeUndefined();
  });

  it('should prefer the identity country over the search location', () => {
    expect(
      identityCountryCodes(identity({ country: 'India' }), 'Dubai'),
    ).toEqual(['IN']);
  });
});

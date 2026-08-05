import {
  normalizeSalesNavigatorCompaniesSearchRequest,
  normalizeSalesNavigatorPeopleSearchRequest,
} from 'src/engine/core-modules/linkedin-search/utils/normalize-sales-navigator-search-request.util';

describe('normalizeSalesNavigatorPeopleSearchRequest', () => {
  it('converts classic flat arrays and job_title into Sales Navigator shape', () => {
    const normalized = normalizeSalesNavigatorPeopleSearchRequest({
      api: 'sales_navigator',
      category: 'people',
      job_title: ['14'],
      industry: ['60'],
      location: ['102713980'],
    });

    expect(normalized).toEqual({
      api: 'sales_navigator',
      category: 'people',
      role: { include: ['14'] },
      industry: { include: ['60'] },
      location: { include: ['102713980'] },
    });
  });

  it('leaves already-correct include/exclude objects unchanged', () => {
    const request = {
      api: 'sales_navigator',
      category: 'people',
      role: { include: ['14'], exclude: ['99'] },
      industry: { include: ['60'] },
      location: { include: ['102713980'] },
    };

    expect(normalizeSalesNavigatorPeopleSearchRequest(request)).toEqual(
      request,
    );
  });
});

describe('normalizeSalesNavigatorCompaniesSearchRequest', () => {
  it('converts classic flat industry/location arrays', () => {
    expect(
      normalizeSalesNavigatorCompaniesSearchRequest({
        api: 'sales_navigator',
        category: 'companies',
        industry: ['60'],
        location: ['102713980'],
      }),
    ).toEqual({
      api: 'sales_navigator',
      category: 'companies',
      industry: { include: ['60'] },
      location: { include: ['102713980'] },
    });
  });
});

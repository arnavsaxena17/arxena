import { buildUnipileSalesNavSearchRequest } from '../build-unipile-sales-nav-search-request.util';

describe('buildUnipileSalesNavSearchRequest', () => {
  it('should omit keywords when function facets are present', () => {
    const request = buildUnipileSalesNavSearchRequest({
      keywords: 'market OR strategy OR marketing',
      companyParameterIds: ['10155014'],
      primaryCompanyName: 'vista rooms',
      functionIds: ['15'],
      seniorities: [],
    });

    expect(request.keywords).toBeUndefined();
    expect(request.function).toEqual({ include: ['15'] });
    expect(request.company).toEqual({ include: ['10155014'] });
  });

  it('should omit keywords when seniority facets are present', () => {
    const request = buildUnipileSalesNavSearchRequest({
      keywords: 'market OR strategy',
      companyParameterIds: ['10155014'],
      primaryCompanyName: 'vista rooms',
      functionIds: [],
      seniorities: ['cxo', 'director'],
    });

    expect(request.keywords).toBeUndefined();
    expect(request.seniority).toEqual({
      include: ['cxo', 'director'],
    });
  });

  it('should send keywords when no function or seniority facets are present', () => {
    const request = buildUnipileSalesNavSearchRequest({
      keywords: 'market OR strategy',
      companyParameterIds: ['10155014'],
      primaryCompanyName: 'vista rooms',
      functionIds: [],
      seniorities: [],
    });

    expect(request.keywords).toBe('market OR strategy');
    expect(request.company).toEqual({ include: ['10155014'] });
  });
});

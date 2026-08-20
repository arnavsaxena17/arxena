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
    expect(request.current_company).toEqual({ include: ['10155014'] });
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

  it('should send CSV keywords and job-title boolean on separate LinkedIn fields', () => {
    const request = buildUnipileSalesNavSearchRequest({
      keywords: 'technology OR software',
      jobTitle: '("CTO" OR "chief technology officer")',
      companyParameterIds: ['10155014'],
      primaryCompanyName: 'vista rooms',
      functionIds: ['13'],
      seniorities: ['cxo'],
      includeManualLinkedInQuery: true,
    });

    expect(request.keywords).toBe('technology OR software');
    expect(request.role).toEqual({
      include: ['("CTO" OR "chief technology officer")'],
    });
    expect(request.current_job_title).toEqual({
      include: ['("CTO" OR "chief technology officer")'],
    });
    expect(request.role?.exclude).toBeUndefined();
    expect(request.function).toBeUndefined();
    expect(request.seniority).toBeUndefined();
    expect(request.company).toEqual({ include: ['10155014'] });
  });

  it('should send generated job-title booleans on role.include', () => {
    const request = buildUnipileSalesNavSearchRequest({
      keywords: 'technology OR software',
      jobTitle:
        '("CTO" OR "chief technology officer") AND (head OR director)',
      companyParameterIds: ['10155014'],
      primaryCompanyName: 'vista rooms',
      functionIds: ['13'],
      seniorities: ['cxo'],
    });

    expect(request.keywords).toBe('technology OR software');
    expect(request.role).toEqual({
      include: [
        '("CTO" OR "chief technology officer") AND (head OR director)',
      ],
    });
    expect(request.function).toBeUndefined();
    expect(request.seniority).toBeUndefined();
  });

  it('should omit function and seniority when only manual keywords are present', () => {
    const request = buildUnipileSalesNavSearchRequest({
      keywords: 'technology OR software',
      companyParameterIds: ['10155014'],
      primaryCompanyName: 'vista rooms',
      functionIds: ['13'],
      seniorities: ['cxo'],
      includeManualLinkedInQuery: true,
    });

    expect(request.keywords).toBe('technology OR software');
    expect(request.function).toBeUndefined();
    expect(request.seniority).toBeUndefined();
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

import { CompanyApiService } from '../company-api.service';

describe('CompanyApiService', () => {
  const companiesEsService = {
    isEnabled: jest.fn().mockReturnValue(true),
    searchCompanies: jest.fn(),
  };
  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(false),
    searchCompanies: jest.fn(),
  };
  const linkedInSearchService = {
    searchCompanies: jest.fn(),
    searchCompaniesSalesNavigator: jest.fn(),
    searchCompaniesRecruiter: jest.fn(),
    searchFromUrl: jest.fn(),
    searchWithCursor: jest.fn(),
    browseSalesAccountList: jest.fn(),
  };
  const unipileSearchAccountResolver = {
    isUnipileConfigured: jest.fn().mockReturnValue(true),
  };
  const companySearchDataSourceResolver = {
    resolve: jest.fn(),
  };

  const companySearchHitTransformer = {
    fromIndexItem: jest.fn((item) => ({
      id: item.id ?? '',
      name: item.name ?? '',
      website: item.website ?? '',
      linkedinUrl: item.linkedin_url ?? '',
      industry: item.industry ?? '',
    })),
    fromHarvestItem: jest.fn(),
    fromUnipileItems: jest.fn((items) =>
      items
        .filter((item: { type?: string }) => item.type === 'COMPANY')
        .map((item: { id?: string; name?: string }) => ({
          id: item.id ?? '',
          name: item.name ?? '',
          website: '',
          linkedinUrl: '',
          industry: '',
        })),
    ),
  };
  const linkedinParameterResolver = {
    resolveLocationName: jest.fn(async (value: string) => ({
      id: value,
      title: value,
    })),
    resolveParameterIds: jest.fn(async (params: { industry?: { include?: string[] } }) => params),
  };

  const service = new CompanyApiService(
    companiesEsService as never,
    harvestLinkedinService as never,
    linkedInSearchService as never,
    unipileSearchAccountResolver as never,
    companySearchDataSourceResolver as never,
    companySearchHitTransformer as never,
    linkedinParameterResolver as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches the companies index', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'index',
    });
    companiesEsService.searchCompanies.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'acme',
          name: 'Acme',
          website: 'acme.com',
          linkedin_url: 'https://www.linkedin.com/company/acme',
          industry: 'Software',
        },
      ],
    });

    await expect(
      service.searchCompanies({ companyName: 'Acme' }, 'token'),
    ).resolves.toMatchObject({
      dataSource: 'index',
      items: [{ name: 'Acme', website: 'acme.com' }],
    });
  });

  it('uses Sales Navigator Unipile company search', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'unipile',
      accountId: 'sn-acct',
      unipileProduct: 'sales_navigator',
    });
    linkedInSearchService.searchCompaniesSalesNavigator.mockResolvedValue({
      items: [
        {
          type: 'COMPANY',
          id: '1',
          name: 'Acme',
          profile_url: 'https://www.linkedin.com/company/acme',
          industry: 'Software',
        },
      ],
    });

    await expect(
      service.searchCompanies({ companyName: 'Acme' }, 'token'),
    ).resolves.toMatchObject({
      dataSource: 'unipile',
      unipileProduct: 'sales_navigator',
      items: [{ name: 'Acme' }],
    });
    expect(
      linkedInSearchService.searchCompaniesSalesNavigator,
    ).toHaveBeenCalled();
  });

  it('parses a Sales Navigator account list URL into account_lists', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'unipile',
      accountId: 'sn-acct',
      unipileProduct: 'sales_navigator',
    });
    linkedInSearchService.searchCompaniesSalesNavigator.mockResolvedValue({
      items: [
        {
          type: 'COMPANY',
          id: '5652',
          name: 'Egon Zehnder',
          profile_url: 'https://www.linkedin.com/company/egon-zehnder/',
        },
      ],
    });

    await expect(
      service.searchCompanies(
        {
          url: 'https://www.linkedin.com/sales/accounts/dashboard?listGroup=CUSTOM_LISTS&listId=7378394885466337283',
        },
        'token',
      ),
    ).resolves.toMatchObject({
      items: [{ name: 'Egon Zehnder' }],
    });
    expect(
      linkedInSearchService.searchCompaniesSalesNavigator,
    ).toHaveBeenCalledWith(
      { account_lists: { include: ['7378394885466337283'] } },
      'sn-acct',
      { limit: 20 },
    );
    expect(linkedInSearchService.searchFromUrl).not.toHaveBeenCalled();
    expect(linkedInSearchService.browseSalesAccountList).not.toHaveBeenCalled();
  });

  it('routes account list URLs to Unipile v2 browse when useV2 is true', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'unipile',
      accountId: 'acc_123',
      unipileProduct: 'sales_navigator',
    });
    linkedInSearchService.browseSalesAccountList.mockResolvedValue({
      items: [
        {
          type: 'COMPANY',
          id: '5652',
          name: 'Heidrick & Struggles',
        },
      ],
    });

    await expect(
      service.searchCompanies(
        {
          url: 'https://www.linkedin.com/sales/accounts/dashboard?listGroup=CUSTOM_LISTS&listId=7378394885466337283',
          useV2: true,
        },
        'token',
      ),
    ).resolves.toMatchObject({
      items: [{ name: 'Heidrick & Struggles' }],
    });
    expect(linkedInSearchService.browseSalesAccountList).toHaveBeenCalledWith(
      '7378394885466337283',
      'acc_123',
      {
        limit: 20,
        offset: 0,
      },
    );
    expect(
      linkedInSearchService.searchCompaniesSalesNavigator,
    ).not.toHaveBeenCalled();
  });

  it('sends company and people search URLs through Unipile search-from-URL', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'unipile',
      accountId: 'sn-acct',
      unipileProduct: 'sales_navigator',
    });
    linkedInSearchService.searchFromUrl.mockResolvedValue({
      items: [
        {
          type: 'COMPANY',
          id: '1',
          name: 'Acme',
        },
      ],
    });

    const companySearchUrl =
      'https://www.linkedin.com/sales/search/company?query=(filters:List((type:COMPANY_HEADCOUNT,values:List((id:E,text:201-500,selectionType:INCLUDED)))))';

    await expect(
      service.searchCompanies({ url: companySearchUrl }, 'token'),
    ).resolves.toMatchObject({
      items: [{ name: 'Acme' }],
    });
    expect(linkedInSearchService.searchFromUrl).toHaveBeenCalledWith(
      expect.stringContaining('/sales/search/company'),
      'sn-acct',
      { limit: 20 },
    );
    expect(
      linkedInSearchService.searchCompaniesSalesNavigator,
    ).not.toHaveBeenCalled();
  });

  it('pages Unipile company search with cursor until limit or last page', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'unipile',
      accountId: 'sn-acct',
      unipileProduct: 'sales_navigator',
    });
    const page = (start: number, count: number, cursor: string | null) => ({
      items: Array.from({ length: count }, (_, index) => ({
        type: 'COMPANY',
        id: String(start + index),
        name: `Co ${start + index}`,
      })),
      paging: { start, page_count: count, total_count: 25 },
      cursor,
    });
    linkedInSearchService.searchCompaniesSalesNavigator.mockResolvedValue(
      page(0, 10, 'cursor-1'),
    );
    linkedInSearchService.searchWithCursor
      .mockResolvedValueOnce(page(10, 10, 'cursor-2'))
      .mockResolvedValueOnce(page(20, 5, null));

    const result = await service.searchCompanies(
      { companyName: 'Acme', limit: 25 },
      'token',
    );

    expect(result.items).toHaveLength(25);
    expect(result.total).toBe(25);
    expect(linkedInSearchService.searchWithCursor).toHaveBeenCalledTimes(2);
    expect(linkedInSearchService.searchWithCursor).toHaveBeenNthCalledWith(
      1,
      'cursor-1',
      'sn-acct',
      { limit: 25 },
    );
  });

  it('stops v2 account-list paging at the first already-known company', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'unipile',
      accountId: 'sn-acct',
      unipileProduct: 'sales_navigator',
    });
    linkedInSearchService.browseSalesAccountList.mockResolvedValue({
      items: [
        { type: 'COMPANY', id: '1', name: 'New 1' },
        { type: 'COMPANY', id: '2', name: 'New 2' },
        { type: 'COMPANY', id: '3', name: 'Old 3' },
        { type: 'COMPANY', id: '4', name: 'New 4' },
      ],
      paging: { start: 0, page_count: 4, total_count: 40 },
      cursor: 'next',
    });

    const url =
      'https://www.linkedin.com/sales/accounts/dashboard?listGroup=CUSTOM_LISTS&listId=ACCOUNT_7378394885466337283';

    const result = await service.searchCompanies(
      { url, useV2: true, limit: 20 },
      'token',
      {
        isKnownHit: (hit) => hit.id === '3',
        stopAtKnown: true,
      },
    );

    expect(result.items.map((item) => item.id)).toEqual(['1', '2']);
    expect(linkedInSearchService.browseSalesAccountList).toHaveBeenCalledTimes(
      1,
    );
    expect(linkedInSearchService.searchWithCursor).not.toHaveBeenCalled();
  });

  it('skips already-known companies on keyword search without stopping pagination', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'unipile',
      accountId: 'sn-acct',
      unipileProduct: 'sales_navigator',
    });
    const page = (start: number, count: number, cursor: string | null) => ({
      items: Array.from({ length: count }, (_, index) => ({
        type: 'COMPANY',
        id: String(start + index),
        name: `Co ${start + index}`,
      })),
      paging: { start, page_count: count, total_count: 20 },
      cursor,
    });
    linkedInSearchService.searchCompaniesSalesNavigator.mockResolvedValue(
      page(0, 2, 'cursor-1'),
    );
    linkedInSearchService.searchWithCursor.mockResolvedValue(
      page(2, 2, null),
    );

    const result = await service.searchCompanies(
      { companyName: 'Acme', limit: 3 },
      'token',
      {
        isKnownHit: (hit) => hit.id === '1',
        stopAtKnown: false,
      },
    );

    expect(result.items.map((item) => item.id)).toEqual(['0', '2', '3']);
    expect(linkedInSearchService.searchWithCursor).toHaveBeenCalledTimes(1);
  });

  it('uses Harvest company search total and collected items', async () => {
    companySearchDataSourceResolver.resolve.mockResolvedValue({
      dataSource: 'harvest',
    });
    harvestLinkedinService.isConfigured.mockReturnValue(true);
    harvestLinkedinService.searchCompanies.mockResolvedValue({
      total: 40,
      items: [{ name: 'Acme' }],
    });
    companySearchHitTransformer.fromHarvestItem.mockImplementation((item) => ({
      id: '',
      name: item.name ?? '',
      website: '',
      linkedinUrl: '',
      industry: '',
    }));

    await expect(
      service.searchCompanies({ companyName: 'Acme', limit: 10 }, 'token'),
    ).resolves.toMatchObject({
      dataSource: 'harvest',
      total: 40,
      items: [{ name: 'Acme' }],
    });
  });
});

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

  const service = new CompanyApiService(
    companiesEsService as never,
    harvestLinkedinService as never,
    linkedInSearchService as never,
    unipileSearchAccountResolver as never,
    companySearchDataSourceResolver as never,
    companySearchHitTransformer as never,
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
          sortBy: 'DATE_ADDED',
          sortOrder: 'DESCENDING',
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
        sortBy: 'DATE_ADDED',
        sortOrder: 'DESCENDING',
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
});

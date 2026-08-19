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
});

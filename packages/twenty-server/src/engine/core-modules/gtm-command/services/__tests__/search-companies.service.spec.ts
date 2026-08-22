import { SearchCompaniesService } from '../search-companies.service';

describe('SearchCompaniesService', () => {
  const companyApiService = {
    searchCompanies: jest.fn(),
  };
  const workspaceQueryService = {
    getApiKeys: jest.fn(),
  };
  const apiKeyService = {
    generateApiKeyToken: jest.fn(),
  };
  const unipileSearchAccountResolver = {
    resolveDefaultWorkspaceAccount: jest.fn(),
  };

  const service = new SearchCompaniesService(
    companyApiService as never,
    workspaceQueryService as never,
    apiKeyService as never,
    unipileSearchAccountResolver as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an error when the workspace has no API token', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([]);

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { companyName: 'Acme' },
      }),
    ).resolves.toMatchObject({
      success: false,
      companies: [],
    });
  });

  it('maps Company API hits', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' }]);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'tok' });
    unipileSearchAccountResolver.resolveDefaultWorkspaceAccount.mockResolvedValue(
      { accountId: 'acc_member', product: 'sales_navigator' },
    );
    companyApiService.searchCompanies.mockResolvedValue({
      status: 'ok',
      dataSource: 'unipile',
      total: 1,
      items: [
        {
          id: 'acme',
          name: 'Acme',
          website: 'acme.com',
          linkedinUrl: 'https://www.linkedin.com/company/acme',
          industry: 'Software',
        },
      ],
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { companyName: 'Acme' },
      }),
    ).resolves.toMatchObject({
      success: true,
      dataSource: 'unipile',
      companies: [{ name: 'Acme', website: 'acme.com' }],
    });
    expect(companyApiService.searchCompanies).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Acme',
        accountId: 'acc_member',
        dataSource: 'auto',
        useV2: true,
      }),
      'tok',
    );
  });

  it('passes Sales Navigator account list URLs through Unipile v2 browse', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' }]);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'tok' });
    unipileSearchAccountResolver.resolveDefaultWorkspaceAccount.mockResolvedValue(
      { accountId: 'tcUOzQ5hT9ycSvHIHQx0JA', product: 'sales_navigator' },
    );
    companyApiService.searchCompanies.mockResolvedValue({
      status: 'ok',
      dataSource: 'unipile',
      total: 0,
      items: [],
    });

    const url =
      'https://www.linkedin.com/sales/accounts/dashboard?listGroup=CUSTOM_LISTS&listId=ACCOUNT_7378394885466337283';

    await service.execute({
      workspaceId: 'ws-1',
      input: { url },
    });

    expect(companyApiService.searchCompanies).toHaveBeenCalledWith(
      expect.objectContaining({
        url,
        useV2: true,
      }),
      'tok',
    );
  });
});

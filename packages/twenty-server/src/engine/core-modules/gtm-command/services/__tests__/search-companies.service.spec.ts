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

  const service = new SearchCompaniesService(
    companyApiService as never,
    workspaceQueryService as never,
    apiKeyService as never,
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
  });
});

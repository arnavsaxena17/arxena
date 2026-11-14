import { SearchCrunchbaseCompaniesService } from '../search-crunchbase-companies.service';

describe('SearchCrunchbaseCompaniesService', () => {
  const apifyService = {
    isConfigured: jest.fn().mockReturnValue(true),
    runActorAndListDatasetItemsDetailed: jest.fn(),
  };
  const companySearchHitTransformer = {
    fromCrunchbaseItems: jest.fn().mockReturnValue([
      {
        id: 'uuid-1',
        name: 'Ather Energy',
        website: 'http://www.atherenergy.com',
        linkedinUrl: 'http://www.linkedin.com/company/ather-energy',
        industry: 'Automotive',
      },
    ]),
  };
  const environmentService = {
    get: jest.fn().mockReturnValue('BBfgvSNWcySEk1jQO'),
  };
  const gtmWorkspaceAuthTokenService = {
    resolveOrMint: jest.fn(),
  };
  const workspaceMemberUnipileService = {
    getWorkspaceMemberCrunchbaseCookies: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(),
    getRepository: jest.fn(),
  };

  const service = new SearchCrunchbaseCompaniesService(
    apifyService as never,
    companySearchHitTransformer as never,
    environmentService as never,
    gtmWorkspaceAuthTokenService as never,
    workspaceMemberUnipileService as never,
    globalWorkspaceOrmManager as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    apifyService.isConfigured.mockReturnValue(true);
    environmentService.get.mockReturnValue('BBfgvSNWcySEk1jQO');
    companySearchHitTransformer.fromCrunchbaseItems.mockReturnValue([
      {
        id: 'uuid-1',
        name: 'Ather Energy',
        website: 'http://www.atherenergy.com',
        linkedinUrl: 'http://www.linkedin.com/company/ather-energy',
        industry: 'Automotive',
      },
    ]);
  });

  it('returns error when searchUrl is missing', async () => {
    const result = await service.execute({
      workspaceId: 'ws-1',
      input: {
        cookie: [
          {
            name: 'authcookie',
            value: 'token',
            domain: '.crunchbase.com',
            path: '/',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      success: false,
      dataSource: 'crunchbase',
      error: 'searchUrl is required (Crunchbase discover URL)',
      companies: [],
    });
    expect(
      apifyService.runActorAndListDatasetItemsDetailed,
    ).not.toHaveBeenCalled();
  });

  it('runs Apify with workspace member cookies and returns transformed companies', async () => {
    apifyService.runActorAndListDatasetItemsDetailed.mockResolvedValue({
      run: { runId: 'run-1', status: 'SUCCEEDED', defaultDatasetId: 'ds-1' },
      items: [{ uuid: 'uuid-1', name: 'Ather Energy' }],
      logText: null,
    });
    gtmWorkspaceAuthTokenService.resolveOrMint.mockResolvedValue('api-token');
    workspaceMemberUnipileService.getWorkspaceMemberCrunchbaseCookies.mockResolvedValue(
      {
        crunchbaseCookies: [
          {
            name: 'authcookie',
            value: 'token',
            domain: '.crunchbase.com',
            path: '/',
          },
        ],
        crunchbaseCookiesLastSyncedAt: null,
      },
    );

    const result = await service.execute({
      workspaceId: 'ws-1',
      input: {
        searchUrl:
          'https://www.crunchbase.com/discover/organization.companies/abc',
        workspaceMemberId: 'wm-1',
        minDelay: 1,
        maxDelay: 5,
      },
    });

    expect(
      workspaceMemberUnipileService.getWorkspaceMemberCrunchbaseCookies,
    ).toHaveBeenCalledWith('api-token', 'wm-1');
    expect(
      apifyService.runActorAndListDatasetItemsDetailed,
    ).toHaveBeenCalledWith(
      'BBfgvSNWcySEk1jQO',
      expect.objectContaining({
        'search.url':
          'https://www.crunchbase.com/discover/organization.companies/abc',
        minDelay: 1,
        maxDelay: 5,
      }),
    );
    expect(result).toMatchObject({
      success: true,
      total: 1,
      dataSource: 'crunchbase',
      companies: [
        expect.objectContaining({
          name: 'Ather Energy',
          industry: 'Automotive',
        }),
      ],
    });
  });
});

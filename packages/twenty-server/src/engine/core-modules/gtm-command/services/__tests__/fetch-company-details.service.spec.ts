import { FetchCompanyDetailsService } from '../fetch-company-details.service';

describe('FetchCompanyDetailsService', () => {
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(),
    getRepository: jest.fn(),
  };
  const unipileCompanyService = {
    extractPublicIdentifier: jest.fn((value: string) => {
      const match = value.match(/linkedin\.com\/company\/([^/?]+)/i);
      return match ? match[1] : value;
    }),
    getCompanyProfile: jest.fn(),
  };
  const searchCompaniesService = {
    execute: jest.fn(),
  };

  const service = new FetchCompanyDetailsService(
    globalWorkspaceOrmManager as never,
    unipileCompanyService as never,
    searchCompaniesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockResolvedValue(
      'acc-1',
    );
  });

  it('requires at least one lookup field', async () => {
    await expect(
      service.execute({ workspaceId: 'ws-1', input: {} }),
    ).resolves.toMatchObject({
      success: false,
      error: 'companyName, website, or linkedinUrl is required',
    });
  });

  it('fetches Unipile company profile by LinkedIn URL', async () => {
    unipileCompanyService.getCompanyProfile.mockResolvedValue({
      id: '123',
      name: 'Acme',
      website: 'acme.com',
      profile_url: 'https://www.linkedin.com/company/acme',
      industry: ['Software'],
      description: 'B2B software',
      employee_count: 200,
      public_identifier: 'acme',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          linkedinUrl: 'https://www.linkedin.com/company/acme',
          accountId: 'acc-1',
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      dataSource: 'unipile',
      company: {
        name: 'Acme',
        website: 'acme.com',
        employeeCount: 200,
        publicIdentifier: 'acme',
      },
    });
    expect(searchCompaniesService.execute).not.toHaveBeenCalled();
  });

  it('looks up by company name then enriches from search LinkedIn URL', async () => {
    searchCompaniesService.execute.mockResolvedValue({
      success: true,
      dataSource: 'index',
      companies: [
        {
          id: 'acme',
          name: 'Acme',
          website: 'acme.com',
          linkedinUrl: 'https://www.linkedin.com/company/acme',
          industry: 'Software',
        },
      ],
    });
    unipileCompanyService.getCompanyProfile.mockResolvedValue({
      name: 'Acme Inc',
      website: 'https://acme.com',
      profile_url: 'https://www.linkedin.com/company/acme',
      description: 'Enriched',
      employee_count: 250,
      public_identifier: 'acme',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { companyName: 'Acme', accountId: 'acc-1' },
      }),
    ).resolves.toMatchObject({
      success: true,
      dataSource: 'unipile',
      company: {
        name: 'Acme Inc',
        description: 'Enriched',
        employeeCount: 250,
        website: 'https://acme.com',
      },
    });
  });

  it('returns the search hit when Unipile enrichment is unavailable', async () => {
    searchCompaniesService.execute.mockResolvedValue({
      success: true,
      dataSource: 'index',
      companies: [
        {
          id: 'acme',
          name: 'Acme',
          website: 'acme.com',
          linkedinUrl: '',
          industry: 'Software',
        },
      ],
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { website: 'acme.com' },
      }),
    ).resolves.toMatchObject({
      success: true,
      dataSource: 'index',
      company: { name: 'Acme', website: 'acme.com' },
    });
    expect(unipileCompanyService.getCompanyProfile).not.toHaveBeenCalled();
  });

  it('rethrows LinkedIn account rate limit errors', async () => {
    const { AccountRateLimitDeferredError } = await import(
      'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error'
    );

    unipileCompanyService.getCompanyProfile.mockRejectedValue(
      new AccountRateLimitDeferredError({
        waitMs: 81_711_000,
        accountId: 'acc-1',
        method: 'company_profile',
      }),
    );

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          linkedinUrl: 'https://www.linkedin.com/company/acme',
          accountId: 'acc-1',
        },
      }),
    ).rejects.toBeInstanceOf(AccountRateLimitDeferredError);
  });

  it('rethrows LinkedIn account rate limit errors', async () => {
    const { AccountRateLimitDeferredError } = await import(
      'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error'
    );

    unipileCompanyService.getCompanyProfile.mockRejectedValue(
      new AccountRateLimitDeferredError({
        waitMs: 81_711_000,
        accountId: 'acc-1',
        method: 'company_profile',
      }),
    );

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          linkedinUrl: 'https://www.linkedin.com/company/acme',
          accountId: 'acc-1',
        },
      }),
    ).rejects.toBeInstanceOf(AccountRateLimitDeferredError);
  });

});

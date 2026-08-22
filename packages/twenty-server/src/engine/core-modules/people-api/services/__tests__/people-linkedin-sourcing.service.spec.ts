import { PeopleLinkedInSourcingService } from '../people-linkedin-sourcing.service';

describe('PeopleLinkedInSourcingService company resolution', () => {
  const orgChartSuperImposeService = {
    resolveInputs: jest.fn(),
    buildQueryPlanFromContext: jest.fn(),
    fetchCandidatesForPlan: jest.fn(),
  };
  const pythonQueryGenerationService = {
    generateSearchParameters: jest.fn(),
  };
  const peopleSalesNavAccountResolver = {
    resolve: jest.fn(),
    isUnipileConfigured: jest.fn(),
  };
  const linkedInSearchService = {
    searchPeopleSalesNavigator: jest.fn(),
  };
  const linkedinUnipileSessionService = {
    withLinkedinSession: jest.fn(),
  };
  const unipileCompanyService = {
    extractPublicIdentifier: jest.fn(),
    getCompanyProfile: jest.fn(),
  };
  const harvestLinkedinService = {};
  const harvestLinkedinTransformer = {};
  const titleTaxonomyRemoteService = {
    getManualBooleanQueries: jest.fn(),
  };

  const service = new PeopleLinkedInSourcingService(
    orgChartSuperImposeService as never,
    pythonQueryGenerationService as never,
    peopleSalesNavAccountResolver as never,
    linkedInSearchService as never,
    linkedinUnipileSessionService as never,
    unipileCompanyService as never,
    harvestLinkedinService as never,
    harvestLinkedinTransformer as never,
    titleTaxonomyRemoteService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    peopleSalesNavAccountResolver.resolve.mockResolvedValue({
      candidateSource: 'unipile',
      linkedinUnipileAccountId: 'acct-1',
    });
    titleTaxonomyRemoteService.getManualBooleanQueries.mockResolvedValue({
      items: [],
    });
    orgChartSuperImposeService.resolveInputs.mockResolvedValue({
      resolvedCompanies: [
        {
          slug: 'egon-zehnder',
          linkedinUrl: 'https://www.linkedin.com/company/egon-zehnder/',
          companyName: 'Egon Zehnder',
          resolvedFrom: 'website_url',
        },
      ],
      salesNavigatorSearchUrls: [],
      errors: [],
    });
    unipileCompanyService.extractPublicIdentifier.mockReturnValue(
      'egon-zehnder',
    );
    unipileCompanyService.getCompanyProfile.mockResolvedValue({
      id: '1642',
    });
    linkedinUnipileSessionService.withLinkedinSession.mockImplementation(
      async (
        _token: string,
        _accountId: string,
        callback: (session: { accountId: string }) => Promise<unknown>,
      ) => callback({ accountId: 'acct-1' }),
    );
    linkedInSearchService.searchPeopleSalesNavigator.mockResolvedValue({
      items: [],
    });
  });

  it('resolves a workspace company UUID + website through ES domain lookup', async () => {
    await service.search({
      apiToken: 'token',
      companyId: 'c811bdd7-0489-46b2-b7d7-3bab7c93e610',
      companyName: 'Egon Zehnder',
      website: 'www.egonzehnder.com',
      dataSource: 'unipile',
      accountId: 'acct-1',
      limit: 2,
    });

    expect(orgChartSuperImposeService.resolveInputs).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: {
          websiteUrls: ['www.egonzehnder.com'],
        },
        primaryCompanyId: undefined,
        primaryLinkedinCompanyUrl: undefined,
        primaryCompanyName: 'Egon Zehnder',
      }),
    );
    expect(unipileCompanyService.extractPublicIdentifier).toHaveBeenCalledWith(
      'https://www.linkedin.com/company/egon-zehnder/',
    );
    expect(linkedInSearchService.searchPeopleSalesNavigator).toHaveBeenCalledWith(
      expect.objectContaining({
        company: { include: ['1642'] },
      }),
      'acct-1',
      { limit: 2 },
    );
  });

  it('resolves a saved company LinkedIn URL before website domain lookup', async () => {
    await service.search({
      apiToken: 'token',
      companyId: 'c811bdd7-0489-46b2-b7d7-3bab7c93e610',
      companyName: 'Egon Zehnder',
      website: 'www.egonzehnder.com',
      linkedinCompanyUrl: 'https://www.linkedin.com/company/egon-zehnder/',
      dataSource: 'unipile',
      accountId: 'acct-1',
      limit: 2,
    });

    expect(orgChartSuperImposeService.resolveInputs).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: {
          websiteUrls: ['www.egonzehnder.com'],
          linkedinCompanyUrls: [
            'https://www.linkedin.com/company/egon-zehnder/',
          ],
        },
        primaryLinkedinCompanyUrl:
          'https://www.linkedin.com/company/egon-zehnder/',
        primaryCompanyName: 'Egon Zehnder',
      }),
    );
  });
});

import { SearchPeopleForCompanyService } from '../search-people-for-company.service';

describe('SearchPeopleForCompanyService', () => {
  const companyId = 'c811bdd7-0489-46b2-b7d7-3bab7c93e610';
  const projectId = '84a08312-0e86-59ed-8103-f575c3f17812';
  const peopleApiService = {
    searchPeople: jest.fn(),
  };
  const ensureGtmProjectService = {
    ensureForCompany: jest.fn(),
  };
  const gtmWorkspaceAuthTokenService = {
    resolveApiKeyToken: jest.fn(),
  };
  const unipileSearchAccountResolver = {
    resolveDefaultWorkspaceAccount: jest.fn(),
  };
  const linkedInSearchTransformer = {
    transformSearchResultsToTableFormat: jest.fn((items: unknown[]) => items),
    addMetadataToCandidates: jest.fn((items: unknown[]) => items),
  };
  const companyRepository = {
    findOne: jest.fn(),
  };
  const projectRepository = {
    findOne: jest.fn(),
  };
  const workspaceProfileRepository = {
    find: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) => {
      if (objectName === 'company') {
        return companyRepository;
      }
      if (objectName === 'project') {
        return projectRepository;
      }
      return workspaceProfileRepository;
    }),
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
  };

  const service = new SearchPeopleForCompanyService(
    globalWorkspaceOrmManager as never,
    peopleApiService as never,
    linkedInSearchTransformer as never,
    ensureGtmProjectService as never,
    gtmWorkspaceAuthTokenService as never,
    unipileSearchAccountResolver as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    ensureGtmProjectService.ensureForCompany.mockResolvedValue({
      projectId,
      gtmRunKey: projectId,
    });
    companyRepository.findOne.mockResolvedValue({
      id: companyId,
      name: 'Egon Zehnder',
      domainName: { primaryLinkUrl: 'http://www.egonzehnder.com' },
      linkedinLink: {
        primaryLinkUrl: 'https://www.linkedin.com/company/egon-zehnder/',
      },
    });
    projectRepository.findOne.mockResolvedValue({
      id: projectId,
      name: 'GTM Harvest',
      icpSpec: JSON.stringify({
        buyerTitles: ['Head of Talent'],
        locations: ['United States', 'United Kingdom'],
      }),
      maxPersonasPerCompany: 2,
    });
    workspaceProfileRepository.find.mockResolvedValue([]);
    gtmWorkspaceAuthTokenService.resolveApiKeyToken.mockResolvedValue('tok');
    unipileSearchAccountResolver.resolveDefaultWorkspaceAccount.mockResolvedValue(
      { accountId: 'acct-1', product: 'classic' },
    );
    peopleApiService.searchPeople.mockResolvedValue({
      status: 'ok',
      dataSource: 'unipile',
      total: 0,
      items: [],
    });
  });

  it('forwards the saved company LinkedIn URL into People search', async () => {
    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { companyId },
      }),
    ).resolves.toMatchObject({
      success: true,
      companyId,
      projectId,
    });

    expect(peopleApiService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        companyName: 'Egon Zehnder',
        website: 'www.egonzehnder.com',
        linkedinCompanyUrl: 'https://www.linkedin.com/company/egon-zehnder/',
        jobTitle: 'Head of Talent',
        locations: ['United States', 'United Kingdom'],
        accountId: 'acct-1',
        dataSource: 'auto',
        limit: 10,
      }),
      'tok',
      { workspaceId: 'ws-1' },
    );
  });

  it('uses a 50-person limit for Sales Navigator accounts', async () => {
    unipileSearchAccountResolver.resolveDefaultWorkspaceAccount.mockResolvedValue(
      { accountId: 'acct-sn', product: 'sales_navigator' },
    );

    await service.execute({
      workspaceId: 'ws-1',
      input: { companyId },
    });

    expect(peopleApiService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-sn',
        limit: 50,
      }),
      'tok',
      { workspaceId: 'ws-1' },
    );
  });
});

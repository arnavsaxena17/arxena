import { sleepMs } from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';

import { PeopleLinkedInSourcingService } from '../people-linkedin-sourcing.service';

jest.mock('twenty-shared/utils', () => {
  const actual = jest.requireActual('twenty-shared/utils');

  return {
    ...actual,
    buildRandomizedLinkedInUnipilePageLimits: jest.fn(
      (desired: number, maxPageSize: number) => {
        const limits: number[] = [];
        let remaining = desired;

        while (remaining > 0) {
          const pageLimit = Math.min(maxPageSize, remaining);

          limits.push(pageLimit);
          remaining -= pageLimit;
        }

        return limits;
      },
    ),
  };
});

jest.mock(
  'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util',
  () => {
    const actual = jest.requireActual(
      'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util',
    );

    return {
      ...actual,
      sleepMs: jest.fn().mockResolvedValue(undefined),
      randomOrgChartLinkedInPageDelayMs: jest.fn().mockReturnValue(0),
    };
  },
);

const makeUnipilePeople = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    name: `Person ${prefix} ${index}`,
  }));

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
    searchFromUrl: jest.fn(),
    searchWithCursor: jest.fn(),
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
      cursor: null,
    });
    linkedInSearchService.searchFromUrl.mockResolvedValue({
      items: [],
      cursor: null,
    });
    linkedInSearchService.searchWithCursor.mockResolvedValue({
      items: [],
      cursor: null,
    });
    (sleepMs as jest.Mock).mockClear();
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

  it('uses CSV boolean_query as Sales Nav role when taxonomy matches', async () => {
    titleTaxonomyRemoteService.getManualBooleanQueries.mockResolvedValue({
      items: [
        {
          kind: 'std_function',
          label: 'technology',
          std_grade: 'leadership',
          boolean_query: '("CTO" OR "chief technology officer")',
          keywords: 'technology OR software',
        },
      ],
    });

    await service.search({
      apiToken: 'token',
      companyName: 'Egon Zehnder',
      website: 'www.egonzehnder.com',
      dataSource: 'unipile',
      accountId: 'acct-1',
      stdFunction: 'technology',
      stdFunctionRoot: 'technology',
      stdGrade: 'leadership',
      linkedinSearchKeywords: 'CTO',
      limit: 2,
    });

    expect(titleTaxonomyRemoteService.getManualBooleanQueries).toHaveBeenCalledWith(
      {
        stdFunction: 'technology',
        stdFunctionRoot: 'technology',
        stdGrade: 'leadership',
      },
    );
    expect(
      pythonQueryGenerationService.generateSearchParameters,
    ).not.toHaveBeenCalled();
    expect(linkedInSearchService.searchPeopleSalesNavigator).toHaveBeenCalledWith(
      expect.objectContaining({
        role: { include: ['("CTO" OR "chief technology officer")'] },
        keywords: 'technology OR software',
        company: { include: ['1642'] },
      }),
      'acct-1',
      { limit: 2 },
    );
  });

  it('falls back to the original job title when taxonomy is unclassified', async () => {
    await service.search({
      apiToken: 'token',
      companyName: 'Egon Zehnder',
      website: 'www.egonzehnder.com',
      dataSource: 'unipile',
      accountId: 'acct-1',
      stdFunction: 'unclassified',
      stdGrade: 'leadership',
      linkedinSearchKeywords: 'CEO',
      limit: 2,
    });

    expect(
      titleTaxonomyRemoteService.getManualBooleanQueries,
    ).not.toHaveBeenCalled();
    expect(linkedInSearchService.searchPeopleSalesNavigator).toHaveBeenCalledWith(
      expect.objectContaining({
        role: { include: ['CEO'] },
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

  it('sends one Unipile page of 100 when 100 profiles are requested', async () => {
    linkedInSearchService.searchPeopleSalesNavigator.mockResolvedValue({
      items: makeUnipilePeople(100, 'p1'),
      cursor: 'next-page',
    });

    const result = await service.search({
      apiToken: 'token',
      companyName: 'Egon Zehnder',
      website: 'www.egonzehnder.com',
      dataSource: 'unipile',
      accountId: 'acct-1',
      limit: 100,
    });

    expect(result.items).toHaveLength(100);
    expect(
      linkedInSearchService.searchPeopleSalesNavigator,
    ).toHaveBeenCalledTimes(1);
    expect(
      linkedInSearchService.searchPeopleSalesNavigator,
    ).toHaveBeenCalledWith(expect.any(Object), 'acct-1', { limit: 100 });
    expect(linkedInSearchService.searchWithCursor).not.toHaveBeenCalled();
    expect(sleepMs).not.toHaveBeenCalled();
  });

  it('paginates Unipile at 100 per page and uses cursor after Redis-limited first page', async () => {
    linkedInSearchService.searchPeopleSalesNavigator.mockResolvedValue({
      items: makeUnipilePeople(100, 'p1'),
      cursor: 'cursor-2',
    });
    linkedInSearchService.searchWithCursor.mockResolvedValue({
      items: makeUnipilePeople(50, 'p2'),
      cursor: 'cursor-3',
    });

    const result = await service.search({
      apiToken: 'token',
      companyName: 'Egon Zehnder',
      website: 'www.egonzehnder.com',
      dataSource: 'unipile',
      accountId: 'acct-1',
      limit: 150,
    });

    expect(result.items).toHaveLength(150);
    expect(
      linkedInSearchService.searchPeopleSalesNavigator,
    ).toHaveBeenCalledTimes(1);
    expect(
      linkedInSearchService.searchPeopleSalesNavigator,
    ).toHaveBeenCalledWith(expect.any(Object), 'acct-1', { limit: 100 });
    expect(linkedInSearchService.searchWithCursor).toHaveBeenCalledTimes(1);
    expect(linkedInSearchService.searchWithCursor).toHaveBeenCalledWith(
      'cursor-2',
      'acct-1',
      { limit: 50 },
    );
    expect(sleepMs).toHaveBeenCalledTimes(1);
  });

  it('paginates searchFromUrl with cursor when more than one Unipile page is needed', async () => {
    linkedInSearchService.searchFromUrl.mockResolvedValue({
      items: makeUnipilePeople(100, 'u1'),
      cursor: 'url-cursor-2',
      config: { params: {} },
    });
    linkedInSearchService.searchWithCursor.mockResolvedValue({
      items: makeUnipilePeople(100, 'u2'),
      cursor: null,
      config: { params: {} },
    });

    const result = await service.search({
      apiToken: 'token',
      searchUrl:
        'https://www.linkedin.com/sales/search/people?savedSearchId=4499073553',
      dataSource: 'unipile',
      accountId: 'acct-1',
      limit: 200,
    });

    expect(result.items).toHaveLength(200);
    expect(linkedInSearchService.searchFromUrl).toHaveBeenCalledTimes(1);
    expect(linkedInSearchService.searchFromUrl).toHaveBeenCalledWith(
      expect.stringContaining('sales/search/people'),
      'acct-1',
      { limit: 100 },
    );
    expect(linkedInSearchService.searchWithCursor).toHaveBeenCalledTimes(1);
    expect(linkedInSearchService.searchWithCursor).toHaveBeenCalledWith(
      'url-cursor-2',
      'acct-1',
      { limit: 100 },
    );
    expect(
      linkedInSearchService.searchPeopleSalesNavigator,
    ).not.toHaveBeenCalled();
  });
});

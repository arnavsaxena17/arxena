import { LinkedinOutreachOpenerService } from 'src/engine/core-modules/org-chart-outreach/linkedin-outreach-opener.service';

jest.mock(
  'src/engine/core-modules/org-chart-outreach/utils/outreach-company-resolver.util',
  () => {
    const actual = jest.requireActual(
      'src/engine/core-modules/org-chart-outreach/utils/outreach-company-resolver.util',
    );
    return {
      ...actual,
      sleepMs: jest.fn().mockResolvedValue(undefined),
    };
  },
);

describe('LinkedinOutreachOpenerService', () => {
  const buildService = (outreachAccountMode = 'shared_sales_navigator_pool') => {
    const linkedinUnipileEstimateAccountService = {
      getOutreachAccountMode: jest.fn().mockReturnValue(outreachAccountMode),
      isSharedSalesNavigatorPoolMode: jest
        .fn()
        .mockReturnValue(outreachAccountMode === 'shared_sales_navigator_pool'),
      withOutreachLinkedinSession: jest.fn(
        async (
          _token: string,
          _accountId: string | undefined,
          run: (session: { accountId: string }) => Promise<unknown>,
        ) => run({ accountId: 'unipile-account-1' }),
      ),
    };

    const workspaceMemberProfileUnipileService = {
      getWorkspaceMemberLinkedinProfile: jest.fn().mockResolvedValue({
        me: { public_identifier: 'saikrshna' },
        fullProfile: {
          public_identifier: 'saikrshna',
          first_name: 'Sai',
          headline: 'CHRO',
          work_experience: [],
          skills: [],
        },
        publicIdentifier: 'saikrshna',
      }),
    };

    const linkedinUnipileRequestService = {
      fetchLinkedinSenderFullProfile: jest.fn().mockResolvedValue({
        fromCache: true,
        entry: {
          publicIdentifier: 'saikrshna',
          fullProfile: {
            public_identifier: 'saikrshna',
            first_name: 'Sai',
            headline: 'CHRO',
            work_experience: [],
            skills: [],
          },
        },
      }),
      fetchLinkedinUserProfile: jest.fn().mockResolvedValue({
        public_identifier: 'prenisha-harry-075760b',
        provider_id: 'ACoTARGET',
        first_name: 'Prenisha',
        headline: 'Senior People Director - e.l.f Beauty',
        work_experience: [
          {
            company: 'E.L.F. BEAUTY',
            position: 'Senior People Director, International',
          },
        ],
        skills: [{ name: 'Human Resources' }],
      }),
      fetchLinkedinUserPosts: jest.fn().mockResolvedValue({
        items: [
          {
            text: 'Thrilled to join E.L.F. BEAUTY',
            is_repost: false,
            parsed_datetime: '2025-01-08T09:28:34.694Z',
          },
        ],
      }),
      fetchLinkedinUserComments: jest.fn(),
    };

    const orgChartSuperImposeAutocompleteService = {
      searchCompanies: jest.fn().mockResolvedValue([
        {
          id: '2653969',
          title: 'E.L.F. BEAUTY',
          slug: 'e-l-f-beauty',
          profileUrl: 'https://www.linkedin.com/company/e-l-f-beauty/',
        },
      ]),
    };

    const llmInvoke = jest
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          companies: [
            {
              name: 'E.L.F. BEAUTY',
              rationale: 'Current employer',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'Hi Prenisha — congrats on the e.l.f. move. Happy to share their org chart.',
        }),
      });

    const llmChatModelService = {
      getJSONChatModel: jest.fn().mockReturnValue({ invoke: llmInvoke }),
    };

    const environmentService = {
      get: jest.fn().mockReturnValue('http://localhost:3001'),
    };

    const service = new LinkedinOutreachOpenerService(
      linkedinUnipileRequestService as never,
      linkedinUnipileEstimateAccountService as never,
      workspaceMemberProfileUnipileService as never,
      orgChartSuperImposeAutocompleteService as never,
      llmChatModelService as never,
      environmentService as never,
    );

    return {
      service,
      linkedinUnipileRequestService,
      linkedinUnipileEstimateAccountService,
      workspaceMemberProfileUnipileService,
      orgChartSuperImposeAutocompleteService,
      llmInvoke,
    };
  };

  it('runs pipeline and returns generated connection request message', async () => {
    console.log('LinkedinOutreachOpenerService pipeline: start');
    const { service, linkedinUnipileRequestService, orgChartSuperImposeAutocompleteService, llmInvoke } =
      buildService();

    const result = await service.generateMessage({
      targetIdentifier: 'prenisha-harry-075760b',
      messageType: 'connection_request',
      includeOrgChartLinks: true,
      includePosts: true,
      includeComments: false,
      apiToken: 'token',
      workspaceMemberId: 'member-1',
      workspaceId: 'workspace-1',
    });

    expect(
      linkedinUnipileRequestService.fetchLinkedinSenderFullProfile,
    ).not.toHaveBeenCalled();
    expect(
      linkedinUnipileRequestService.fetchLinkedinUserProfile,
    ).toHaveBeenCalledWith(
      'unipile-account-1',
      'prenisha-harry-075760b',
      expect.objectContaining({
        linkedinSections: ['*'],
        cleanupContext: expect.objectContaining({
          isSharedPoolAccount: true,
        }),
      }),
    );
    expect(orgChartSuperImposeAutocompleteService.searchCompanies).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: 'E.L.F. BEAUTY' }),
    );
    expect(llmInvoke).toHaveBeenCalledTimes(2);
    expect(result.messageType).toBe('connection_request');
    expect(result.message).toContain('Prenisha');
    expect(result.suggestedCompanies[0]?.linkedinSlug).toBe('e-l-f-beauty');
    expect(result.contextUsed.senderProfileFromCache).toBe(true);
    expect(result.contextUsed.postsCount).toBe(1);
    console.log('LinkedinOutreachOpenerService pipeline: success', result);
  });
});

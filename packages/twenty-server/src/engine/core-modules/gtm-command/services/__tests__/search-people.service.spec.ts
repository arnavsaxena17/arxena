import { SearchPeopleService } from '../search-people.service';

describe('SearchPeopleService', () => {
  const peopleApiService = {
    searchPeople: jest.fn(),
  };
  const gtmWorkspaceAuthTokenService = {
    resolveApiKeyToken: jest.fn(),
  };

  const service = new SearchPeopleService(
    peopleApiService as never,
    gtmWorkspaceAuthTokenService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches using workspace context when there is no API key', async () => {
    gtmWorkspaceAuthTokenService.resolveApiKeyToken.mockResolvedValue(null);
    peopleApiService.searchPeople.mockResolvedValue({
      status: 'ok',
      dataSource: 'index',
      total: 0,
      items: [],
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { naturalLanguage: 'CEO at Acme' },
      }),
    ).resolves.toMatchObject({
      success: true,
      people: [],
      dataSource: 'index',
    });
    expect(peopleApiService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({ naturalLanguage: 'CEO at Acme' }),
      undefined,
      { workspaceId: 'ws-1' },
    );
  });

  it('maps People API hits', async () => {
    gtmWorkspaceAuthTokenService.resolveApiKeyToken.mockResolvedValue('tok');
    peopleApiService.searchPeople.mockResolvedValue({
      status: 'ok',
      dataSource: 'index',
      total: 1,
      items: [
        {
          name: 'Ada',
          title: 'CEO',
          linkedinUrl: 'https://www.linkedin.com/in/ada',
          companyName: 'Acme',
        },
      ],
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { naturalLanguage: 'CEO at Acme', limit: 5 },
      }),
    ).resolves.toMatchObject({
      success: true,
      total: 1,
      dataSource: 'index',
      error: '',
      people: [
        {
          name: 'Ada',
          firstName: '',
          lastName: '',
          title: 'CEO',
          linkedinUrl: 'https://www.linkedin.com/in/ada',
          linkedinProfileId: 'ada',
          companyName: 'Acme',
        },
      ],
    });
  });
});

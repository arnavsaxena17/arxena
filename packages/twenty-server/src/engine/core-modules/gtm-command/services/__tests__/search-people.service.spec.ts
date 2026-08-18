import { SearchPeopleService } from '../search-people.service';

describe('SearchPeopleService', () => {
  const peopleApiService = {
    searchPeople: jest.fn(),
  };
  const workspaceQueryService = {
    getApiKeys: jest.fn(),
  };
  const apiKeyService = {
    generateApiKeyToken: jest.fn(),
  };

  const service = new SearchPeopleService(
    peopleApiService as never,
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
        input: { naturalLanguage: 'CEO at Acme' },
      }),
    ).resolves.toMatchObject({
      success: false,
      people: [],
    });
    expect(peopleApiService.searchPeople).not.toHaveBeenCalled();
  });

  it('maps People API hits', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' }]);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'tok' });
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
    ).resolves.toEqual({
      success: true,
      total: 1,
      dataSource: 'index',
      error: '',
      people: [
        {
          name: 'Ada',
          title: 'CEO',
          linkedinUrl: 'https://www.linkedin.com/in/ada',
          companyName: 'Acme',
        },
      ],
    });
  });
});

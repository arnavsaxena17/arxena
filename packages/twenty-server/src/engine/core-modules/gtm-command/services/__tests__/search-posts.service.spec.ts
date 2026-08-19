import { SearchPostsService } from '../search-posts.service';

describe('SearchPostsService', () => {
  const postsApiService = {
    searchPosts: jest.fn(),
  };
  const workspaceQueryService = {
    getApiKeys: jest.fn(),
  };
  const apiKeyService = {
    generateApiKeyToken: jest.fn(),
  };

  const service = new SearchPostsService(
    postsApiService as never,
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
        input: { keywords: 'hiring' },
      }),
    ).resolves.toMatchObject({
      success: false,
      posts: [],
    });
    expect(postsApiService.searchPosts).not.toHaveBeenCalled();
  });

  it('maps Posts API hits', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' }]);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'tok' });
    postsApiService.searchPosts.mockResolvedValue({
      status: 'ok',
      dataSource: 'unipile',
      total: 1,
      items: [
        {
          id: 'post-1',
          title: 'Hiring',
          text: 'We are hiring',
          shareUrl: 'https://www.linkedin.com/feed/update/1',
        },
      ],
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { keywords: 'hiring' },
      }),
    ).resolves.toMatchObject({
      success: true,
      posts: [{ title: 'Hiring' }],
    });
  });
});

import { SearchJobsService } from '../search-jobs.service';

describe('SearchJobsService', () => {
  const jobApiService = {
    searchJobs: jest.fn(),
  };
  const workspaceQueryService = {
    getApiKeys: jest.fn(),
  };
  const apiKeyService = {
    generateApiKeyToken: jest.fn(),
  };

  const service = new SearchJobsService(
    jobApiService as never,
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
        input: { keywords: 'engineer' },
      }),
    ).resolves.toMatchObject({
      success: false,
      jobs: [],
    });
    expect(jobApiService.searchJobs).not.toHaveBeenCalled();
  });

  it('maps Jobs API hits', async () => {
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' }]);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'tok' });
    jobApiService.searchJobs.mockResolvedValue({
      status: 'ok',
      dataSource: 'unipile',
      total: 1,
      items: [
        {
          id: 'job-1',
          title: 'Engineer',
          location: 'Remote',
          url: 'https://www.linkedin.com/jobs/view/1',
          companyName: 'Acme',
          postedAt: '2026-08-01',
        },
      ],
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: { keywords: 'engineer' },
      }),
    ).resolves.toMatchObject({
      success: true,
      jobs: [{ title: 'Engineer', companyName: 'Acme' }],
    });
  });
});

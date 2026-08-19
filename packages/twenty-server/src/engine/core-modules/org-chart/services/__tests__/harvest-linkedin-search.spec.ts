import { HarvestLinkedinService } from '../harvest-linkedin.service';

describe('HarvestLinkedinService company/job search', () => {
  const environmentService = {
    get: jest.fn((key: string) => {
      if (key === 'HARVEST_API_KEY') {
        return 'harvest-key';
      }
      if (key === 'HARVEST_API_BASE_URL') {
        return 'https://api.harvest-api.com';
      }

      return undefined;
    }),
  };

  const service = new HarvestLinkedinService(environmentService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    environmentService.get.mockImplementation((key: string) => {
      if (key === 'HARVEST_API_KEY') {
        return 'harvest-key';
      }
      if (key === 'HARVEST_API_BASE_URL') {
        return 'https://api.harvest-api.com';
      }

      return undefined;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('searches companies via Harvest company-search', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            name: 'Acme',
            website: 'acme.com',
            linkedinUrl: 'https://www.linkedin.com/company/acme',
          },
        ],
        pagination: { totalElements: 1, totalPages: 1 },
      }),
    } as Response);

    const result = await service.searchCompanies({
      search: 'Acme',
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ name: 'Acme' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/linkedin/company-search?'),
      expect.objectContaining({
        headers: { 'X-API-Key': 'harvest-key' },
      }),
    );
  });

  it('searches jobs via Harvest job-search', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        jobs: [{ title: 'Engineer', company: 'Acme' }],
        pagination: { totalElements: 1, totalPages: 1 },
      }),
    } as Response);

    const result = await service.searchJobs({
      search: 'engineer',
      limit: 5,
    });

    expect(result.items[0]).toMatchObject({ title: 'Engineer' });
  });

  it('searches posts via Harvest post-search', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            id: 'post-1',
            content: 'Hiring',
            linkedinUrl: 'https://www.linkedin.com/feed/update/1',
          },
        ],
        pagination: { totalElements: 1, totalPages: 1 },
      }),
    } as Response);

    const result = await service.searchPosts({
      search: 'hiring',
      postedLimit: '24h',
      sortBy: 'relevance',
      limit: 10,
    });

    expect(result.items[0]).toMatchObject({ content: 'Hiring' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/linkedin/post-search?'),
      expect.objectContaining({
        headers: { 'X-API-Key': 'harvest-key' },
      }),
    );
    expect(fetchMock.mock.calls[0][0]).toContain('postedLimit=24h');
    expect(fetchMock.mock.calls[0][0]).toContain('sortBy=relevance');
  });
});

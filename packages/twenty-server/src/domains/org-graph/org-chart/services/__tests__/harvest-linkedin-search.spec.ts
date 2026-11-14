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

  it('prefers a resolved geo id over the location text in the lead URL', () => {
    const withGeoId = service.buildLeadSearchUrlFromParams({
      locations: 'Mumbai, Maharashtra, India',
      geoIds: '90009639',
      sessionId: 'session-1',
      page: 3,
    });

    expect(withGeoId).toContain('geoIds=90009639');
    expect(withGeoId).toContain('page=3');
    expect(withGeoId).not.toContain('locations=');
  });

  it('keeps the location text when no id resolved', () => {
    const withoutGeoId = service.buildLeadSearchUrlFromParams({
      locations: 'Mumbai, Maharashtra, India',
      sessionId: 'session-1',
      page: 1,
    });

    expect(withoutGeoId).toContain('locations=Mumbai%2C+Maharashtra%2C+India');
  });

  it('resolves the location before the lead search runs', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            { geoId: '106164952', title: 'Mumbai, Maharashtra, India' },
            { geoId: '90009639', title: 'Mumbai Metropolitan Region' },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [],
          pagination: { totalElements: 0, totalPages: 0 },
        }),
      } as Response);

    await service.estimateLeadSearchTotalElements({
      currentCompanies: 'https://www.linkedin.com/company/acme',
      locations: 'Mumbai',
      sessionId: 'session-1',
    });

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/linkedin/geo-id-search?search=Mumbai',
    );

    const leadSearchUrl = fetchMock.mock.calls[1][0] as string;

    expect(leadSearchUrl).toContain('/linkedin/lead-search?');
    expect(leadSearchUrl).toContain('geoIds=90009639');
    expect(leadSearchUrl).not.toContain('locations=');
  });
});

describe('HarvestLinkedinService billed-call caching', () => {
  const environmentService = {
    get: jest.fn((key: string) =>
      key === 'HARVEST_API_KEY'
        ? 'harvest-key'
        : key === 'HARVEST_API_BASE_URL'
          ? 'https://api.harvest-api.com'
          : undefined,
    ),
  };

  // A stand-in for the Redis-backed cache: same contract, same key space
  const createMemoCache = () => {
    const store = new Map<string, unknown>();

    return {
      getOrFetch: jest.fn(
        async (
          prefix: string,
          parts: unknown,
          fetcher: () => Promise<unknown>,
        ) => {
          const key = `${prefix}:${JSON.stringify(parts)}`;

          if (store.has(key)) {
            return store.get(key);
          }

          const value = await fetcher();

          store.set(key, value);

          return value;
        },
      ),
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches an identical lead-search page once', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [{ id: 'lead-1' }],
        pagination: { totalElements: 1, totalPages: 1 },
      }),
    } as Response);
    const service = new HarvestLinkedinService(
      environmentService as never,
      createMemoCache() as never,
    );
    const params = {
      currentCompanies: 'https://www.linkedin.com/company/acme',
      sessionId: 'session-1',
      page: 1,
    };

    await service.fetchLeadSearchPageFromParams(params);
    await service.fetchLeadSearchPageFromParams(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still fetches a different page', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [{ id: 'lead-1' }],
        pagination: { totalElements: 60, totalPages: 3 },
      }),
    } as Response);
    const service = new HarvestLinkedinService(
      environmentService as never,
      createMemoCache() as never,
    );

    await service.fetchLeadSearchPageFromParams({
      currentCompanies: 'https://www.linkedin.com/company/acme',
      sessionId: 'session-1',
      page: 1,
    });
    await service.fetchLeadSearchPageFromParams({
      currentCompanies: 'https://www.linkedin.com/company/acme',
      sessionId: 'session-1',
      page: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetches an identical profile once', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ element: { firstName: 'Ada' } }),
    } as Response);
    const service = new HarvestLinkedinService(
      environmentService as never,
      createMemoCache() as never,
    );

    await service.fetchProfileByUrl('https://www.linkedin.com/in/ada');
    await service.fetchProfileByUrl('https://www.linkedin.com/in/ada');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not count the batch estimate and the fetch as two paid pages', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [{ id: 'lead-1' }],
        pagination: { totalElements: 1, totalPages: 1 },
      }),
    } as Response);
    const service = new HarvestLinkedinService(
      environmentService as never,
      createMemoCache() as never,
    );
    const batch = {
      currentCompanies: 'https://www.linkedin.com/company/acme',
      sessionId: 'session-1',
    };

    await service.estimateLeadSearchTotalElements(batch);
    await service.fetchAllLeadsFromQueryParams({ params: batch });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

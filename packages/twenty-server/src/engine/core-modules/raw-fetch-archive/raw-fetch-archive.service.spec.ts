import { RawFetchArchiveService } from 'src/engine/core-modules/raw-fetch-archive/raw-fetch-archive.service';

describe('RawFetchArchiveService', () => {
  const buildService = () => {
    const fileStorageService = {
      write: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    };
    const service = new RawFetchArchiveService(
      fileStorageService as never,
      cache as never,
    );

    return { service, fileStorageService, cache };
  };

  it('should write the untouched response to S3 and Redis when archiving', async () => {
    const { service, fileStorageService, cache } = buildService();

    const result = await service.archive({
      provider: 'bright-data',
      endpoint: 'business-search/people',
      workspaceId: 'workspace-1',
      request: { offset: 0, limit: 100 },
      response: { documents: [{ bright_id: 'a' }] },
      pageKey: 0,
      costUsd: 0.2,
    });

    expect(result?.durable).toBe(true);
    expect(cache.set).toHaveBeenCalledTimes(1);

    const call = fileStorageService.write.mock.calls[0][0];

    expect(call.folder).toContain(
      'raw-fetch/bright_data/business_search/people/workspace_1/',
    );
    expect(JSON.parse(call.file.toString()).response).toEqual({
      documents: [{ bright_id: 'a' }],
    });
  });

  it('should keep paginated requests as separate objects when page keys differ', async () => {
    const { service, fileStorageService } = buildService();
    const base = {
      provider: 'apify' as const,
      endpoint: 'dataset-items',
      request: { datasetId: 'd1' },
      response: [],
    };

    await service.archive({ ...base, pageKey: 0 });
    await service.archive({ ...base, pageKey: 1000 });

    const [first, second] = fileStorageService.write.mock.calls.map(
      ([arg]) => arg.name,
    );

    expect(first).not.toEqual(second);
    expect(service.buildRequestHash(base.request, 0)).not.toEqual(
      service.buildRequestHash(base.request, 1000),
    );
  });

  it('should retry S3 and report non-durable when every attempt fails', async () => {
    jest.useRealTimers();

    const { service, fileStorageService } = buildService();

    fileStorageService.write.mockRejectedValue(new Error('s3 down'));

    const result = await service.archive({
      provider: 'serp',
      endpoint: 'google-serp',
      request: {},
      response: {},
    });

    expect(fileStorageService.write).toHaveBeenCalledTimes(3);
    expect(result?.durable).toBe(false);
  });

  it('should never throw when the cache also fails', async () => {
    const { service, cache } = buildService();

    cache.set.mockRejectedValue(new Error('redis down'));

    await expect(
      service.archive({
        provider: 'apollo',
        endpoint: 'x',
        request: {},
        response: {},
      }),
    ).resolves.toMatchObject({ durable: true });
  });
});

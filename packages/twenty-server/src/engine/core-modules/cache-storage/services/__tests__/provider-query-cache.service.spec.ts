import { Readable } from 'stream';

import { ProviderQueryCacheService } from '../provider-query-cache.service';

describe('ProviderQueryCacheService', () => {
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
  const s3 = new Map<string, string>();
  const fileStorage = {
    read: jest.fn(
      async ({
        folderPath,
        filename,
      }: {
        folderPath: string;
        filename: string;
      }) => {
        const content = s3.get(`${folderPath}/${filename}`);

        if (!content) {
          throw new Error('missing');
        }

        return Readable.from([content]);
      },
    ),
    write: jest.fn(
      async ({
        file,
        name,
        folder,
      }: {
        file: Buffer;
        name: string;
        folder: string;
      }) => {
        s3.set(`${folder}/${name}`, file.toString('utf8'));
      },
    ),
  };

  let service: ProviderQueryCacheService;

  beforeEach(() => {
    store.clear();
    s3.clear();
    cache.get.mockClear();
    cache.set.mockClear();
    fileStorage.read.mockClear();
    fileStorage.write.mockClear();
    service = new ProviderQueryCacheService(
      cache as never,
      fileStorage as never,
    );
  });

  it('fetches once and returns cached results on the next identical query', async () => {
    const fetcher = jest.fn().mockResolvedValue({ rows: [1] });

    const first = await service.getOrFetch('test:v1', { q: 'ceo' }, fetcher);
    const second = await service.getOrFetch('test:v1', { q: 'ceo' }, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ rows: [1] });
    expect(second).toEqual({ rows: [1] });
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(fileStorage.write).toHaveBeenCalledTimes(1);
  });

  it('serves from S3 and rehydrates Redis when Redis misses', async () => {
    const fetcher = jest.fn().mockResolvedValue({ rows: [1] });

    await service.getOrFetch('test:v1', { q: 's3' }, fetcher);
    store.clear();
    cache.get.mockClear();
    cache.set.mockClear();

    const second = await service.getOrFetch('test:v1', { q: 's3' }, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ rows: [1] });
    expect(fileStorage.read).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('coalesces in-flight identical queries into one fetch', async () => {
    let resolveFetch: ((value: { rows: number[] }) => void) | undefined;
    let signalStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const fetcher = jest.fn(
      () =>
        new Promise<{ rows: number[] }>((resolve) => {
          resolveFetch = resolve;
          signalStarted?.();
        }),
    );

    const first = service.getOrFetch('test:v1', { q: 'cfo' }, fetcher);
    await started;
    const second = service.getOrFetch('test:v1', { q: 'cfo' }, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveFetch?.({ rows: [2] });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual({ rows: [2] });
    expect(secondResult).toEqual({ rows: [2] });
  });

  it('does not cache a failed fetch', async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce({ rows: [3] });

    await expect(
      service.getOrFetch('test:v1', { q: 'fail' }, fetcher),
    ).rejects.toThrow('provider down');

    const recovered = await service.getOrFetch(
      'test:v1',
      { q: 'fail' },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(recovered).toEqual({ rows: [3] });
  });

  it('get and set round-trip without a fetcher', async () => {
    await service.set('peek:v1', { id: 'a' }, { value: 9 });

    await expect(service.get('peek:v1', { id: 'a' })).resolves.toEqual({
      value: 9,
    });
    await expect(service.get('peek:v1', { id: 'b' })).resolves.toBeUndefined();
  });
});

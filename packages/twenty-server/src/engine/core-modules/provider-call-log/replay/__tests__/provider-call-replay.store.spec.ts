import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { buildProviderQueryCacheKey } from 'src/engine/core-modules/cache-storage/utils/provider-query-cache-key.util';
import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';
import {
  createProviderCallReplayStore,
  getActiveProviderCallReplayStore,
  parseProviderCallRecording,
  PROVIDER_CALL_REPLAY_FILE_ENV,
  ProviderCallReplayMissError,
} from 'src/engine/core-modules/provider-call-log/replay/provider-call-replay.store';
import { ProviderCallLogService } from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';
import { type ProviderCallRecording } from 'src/engine/core-modules/provider-call-log/types/provider-call-recording.type';

const harvestParts = { title: 'CFO', page: 1 };

const recording: ProviderCallRecording = {
  version: 1,
  scenarioId: 'top10-pharma-mumbai-sales-heads',
  recordedAt: '2026-11-16T00:00:00.000Z',
  calls: [
    {
      provider: 'harvest-search',
      operation: 'harvest-search:v1',
      cacheKey: buildProviderQueryCacheKey('harvest-search:v1', harvestParts),
      request: harvestParts,
      response: { elements: [{ name: 'A' }] },
    },
    {
      provider: 'serp',
      operation: 'google',
      cacheKey: null,
      request: { value: 'cfo pune' },
      response: { organic: [1] },
    },
    {
      provider: 'serp',
      operation: 'google',
      cacheKey: null,
      request: { value: 'cfo pune' },
      response: { organic: [1, 2] },
    },
    {
      provider: 'unipile',
      operation: 'search',
      cacheKey: null,
      request: { q: 'x' },
      errorMessage: 'Rate limit reached',
    },
  ],
};

const writeRecording = (): string => {
  const file = join(mkdtempSync(join(tmpdir(), 'replay-')), 'recording.json');

  writeFileSync(file, JSON.stringify(recording));

  return file;
};

describe('provider call replay store', () => {
  afterEach(() => {
    delete process.env[PROVIDER_CALL_REPLAY_FILE_ENV];
  });

  it('should serve repeated requests in order, then repeat the last', () => {
    const store = createProviderCallReplayStore(recording);
    const call = { provider: 'serp', operation: 'google', request: 'cfo pune' };

    expect(store.replay(call)).toEqual({ organic: [1] });
    expect(store.replay(call)).toEqual({ organic: [1, 2] });
    expect(store.replay(call)).toEqual({ organic: [1, 2] });
  });

  it('should throw on a request the recording lacks, and replay a failure', () => {
    const store = createProviderCallReplayStore(recording);

    expect(() =>
      store.replay({ provider: 'serp', operation: 'google', request: 'cto' }),
    ).toThrow(ProviderCallReplayMissError);
    expect(() =>
      store.replay({
        provider: 'unipile',
        operation: 'search',
        request: { q: 'x' },
      }),
    ).toThrow('Rate limit reached');
  });

  it('should reject a file that is not a recording', () => {
    expect(() => parseProviderCallRecording('{"calls": []}')).toThrow(
      /Not a provider call recording/,
    );
  });

  it('should stay off without the env var and refuse production', () => {
    expect(getActiveProviderCallReplayStore()).toBeUndefined();

    process.env[PROVIDER_CALL_REPLAY_FILE_ENV] = writeRecording();
    const nodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'production';
    expect(() => getActiveProviderCallReplayStore()).toThrow(/production/);
    process.env.NODE_ENV = nodeEnv;

    expect(getActiveProviderCallReplayStore()?.scenarioId).toBe(
      recording.scenarioId,
    );
  });

  it('should answer the cache and the call log from the recording, never the fetcher', async () => {
    process.env[PROVIDER_CALL_REPLAY_FILE_ENV] = writeRecording();
    const fetcher = jest.fn();
    const cache = new ProviderQueryCacheService({
      get: jest.fn(),
      set: jest.fn(),
    } as never);
    const callLog = new ProviderCallLogService({ insert: jest.fn() } as never);

    await expect(
      cache.getOrFetch('harvest-search:v1', harvestParts, fetcher),
    ).resolves.toEqual({ elements: [{ name: 'A' }] });
    await expect(cache.get('harvest-search:v1', harvestParts)).resolves.toEqual(
      { elements: [{ name: 'A' }] },
    );
    await expect(
      callLog.track(
        { provider: 'serp', operation: 'google', request: 'cfo pune' },
        fetcher,
      ),
    ).resolves.toEqual({ organic: [1] });
    await expect(
      cache.getOrFetch('harvest-search:v1', { title: 'CEO' }, fetcher),
    ).rejects.toThrow(ProviderCallReplayMissError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

import {
  BrightDataLudicrousDatasetStoreService,
  type BrightDataLudicrousDataset,
} from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-dataset-store.service';

const DATASET: BrightDataLudicrousDataset = {
  planId: 'plan-1',
  entity: 'company',
  documents: [{ brightId: 'a', data: { name: 'Wow! Momo' } }],
  fetchedDocuments: [
    { brightId: 'a', data: { name: 'Wow! Momo' }, relevant: true },
  ],
  spentUsd: 0.002,
  budgetUsd: 1,
  shardReports: [],
  workspaceId: 'workspace-1',
  createdAt: '2026-10-11T00:00:00.000Z',
};

const buildStore = () => {
  const values = new Map<string, unknown>();
  const cache = {
    set: jest.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    get: jest.fn(async (key: string) => values.get(key)),
  };

  return {
    cache,
    store: new BrightDataLudicrousDatasetStoreService(cache as never),
  };
};

describe('BrightDataLudicrousDatasetStoreService', () => {
  it('should return the saved records for the workspace that paid', async () => {
    const { store } = buildStore();

    await store.save(DATASET);

    await expect(store.load('plan-1', 'workspace-1')).resolves.toMatchObject({
      documents: [{ brightId: 'a' }],
    });
  });

  it('should not return another workspace dataset', async () => {
    const { store } = buildStore();

    await store.save(DATASET);

    await expect(store.load('plan-1', 'workspace-2')).resolves.toBeUndefined();
  });

  it('should keep the records for 30 days', async () => {
    const { store, cache } = buildStore();

    await store.save(DATASET);

    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('plan-1'),
      DATASET,
      30 * 24 * 60 * 60 * 1000,
    );
  });
});

import {
  BrightDataLudicrousDatasetStoreService,
  type BrightDataLudicrousDataset,
} from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-dataset-store.service';

const DATASET: BrightDataLudicrousDataset = {
  projectId: 'project-1',
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
    del: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };

  return {
    cache,
    store: new BrightDataLudicrousDatasetStoreService(cache as never),
  };
};

const LOOKUP = {
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  entity: 'company' as const,
};

describe('BrightDataLudicrousDatasetStoreService', () => {
  it('should return the saved records for the workspace that paid', async () => {
    const { store } = buildStore();

    await store.save(DATASET);

    await expect(store.load(LOOKUP)).resolves.toMatchObject({
      documents: [{ brightId: 'a' }],
    });
  });

  it('should not return another workspace dataset', async () => {
    const { store } = buildStore();

    await store.save(DATASET);

    await expect(
      store.load({ ...LOOKUP, workspaceId: 'workspace-2' }),
    ).resolves.toBeUndefined();
  });

  it('should key the dataset by project and entity', async () => {
    const { store, cache } = buildStore();

    await store.save(DATASET);

    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('project-1'),
      DATASET,
      30 * 24 * 60 * 60 * 1000,
    );
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('company'),
      DATASET,
      30 * 24 * 60 * 60 * 1000,
    );
  });

  it('should clear the project dataset when a new estimate replaces it', async () => {
    const { store, cache } = buildStore();

    await store.save(DATASET);
    await store.clear(LOOKUP);

    await expect(store.load(LOOKUP)).resolves.toBeUndefined();
    expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('project-1'));
  });
});

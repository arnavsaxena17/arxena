import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import { OutreachListStoreService } from 'src/engine/core-modules/outreach-list/services/outreach-list-store.service';
import { buildOutreachListRow } from 'src/engine/core-modules/outreach-list/utils/outreach-list-normalizers.util';
import { type OutreachListDocument } from 'src/engine/core-modules/outreach-list/outreach-list.types';

const buildStore = () => {
  const values = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => values.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
  const fileStorage = {
    writeFile: jest.fn(async () => ({ id: 'file' })),
    deleteByFileId: jest.fn(async () => undefined),
  };
  const fileService = { getFileContentById: jest.fn(async () => null) };
  const application = {
    findWorkspaceTwentyStandardAndCustomApplicationOrThrow: jest.fn(
      async () => ({
        workspaceCustomFlatApplication: { universalIdentifier: 'app' },
      }),
    ),
  };
  const store = new OutreachListStoreService(
    cache as never,
    fileStorage as never,
    fileService as never,
    application as never,
  );
  const service = new OutreachListService(
    store,
    fileStorage as never,
    {} as never,
    application as never,
    {} as never,
  );

  return { service, store, cache, fileStorage, fileService };
};

const company = (name: string, website: string) =>
  buildOutreachListRow('company', 'apollo', { name, website }) as NonNullable<
    ReturnType<typeof buildOutreachListRow>
  >;

describe('OutreachListService', () => {
  it('should add new rows and drop duplicates by key', async () => {
    const { service } = buildStore();

    const first = await service.ingest({
      workspaceId: 'ws',
      listId: 'l1',
      name: 'List',
      entity: 'company',
      source: 'apollo',
      rows: [
        company('A', 'https://a.com'),
        company('A again', 'http://www.a.com/'),
      ],
    });
    const second = await service.ingest({
      workspaceId: 'ws',
      listId: 'l1',
      name: 'List',
      entity: 'company',
      source: 'apollo',
      rows: [company('B', 'https://b.com'), company('A', 'https://a.com')],
    });

    expect(first).toMatchObject({ added: 1, duplicates: 1, total: 1 });
    expect(second).toMatchObject({ added: 1, duplicates: 1, total: 2 });
  });

  it('should keep a list 7 days when free and 30 days when a source was paid', async () => {
    const { service, store } = buildStore();
    const days = (iso: string) =>
      Math.round((Date.parse(iso) - Date.now()) / (24 * 60 * 60 * 1000));

    await service.ingest({
      workspaceId: 'ws',
      listId: 'free',
      name: 'Free',
      entity: 'company',
      source: 'apollo',
      rows: [company('A', 'https://a.com')],
    });
    await service.ingest({
      workspaceId: 'ws',
      listId: 'paid',
      name: 'Paid',
      entity: 'company',
      source: 'bright_data',
      rows: [company('B', 'https://b.com')],
      spentUsd: 0.5,
    });

    expect(days((await store.load('ws', 'free'))!.meta.expiresAt)).toBe(7);
    expect(days((await store.load('ws', 'paid'))!.meta.expiresAt)).toBe(30);
  });

  it('should not serve an expired list or another workspace list', async () => {
    const { service, store, cache } = buildStore();

    await service.ingest({
      workspaceId: 'ws',
      listId: 'l1',
      name: 'List',
      entity: 'company',
      source: 'apollo',
      rows: [company('A', 'https://a.com')],
    });

    expect(await store.load('other-ws', 'l1')).toBeUndefined();

    const key = 'outreach-list:ws:l1';
    const document = (await cache.get(key)) as OutreachListDocument;

    document.meta.expiresAt = new Date(Date.now() - 1000).toISOString();
    await cache.set(key, document);

    expect(await store.load('ws', 'l1')).toBeUndefined();
  });

  it('should back the list up to file storage on every write', async () => {
    const { service, fileStorage } = buildStore();

    await service.ingest({
      workspaceId: 'ws',
      listId: 'l1',
      name: 'List',
      entity: 'company',
      source: 'apollo',
      rows: [company('A', 'https://a.com')],
    });

    const paths = fileStorage.writeFile.mock.calls.map(
      (call) => (call as unknown as [{ resourcePath: string }])[0].resourcePath,
    );

    expect(paths).toContain('outreach-lists/l1.json');
    expect(paths).toContain('outreach-lists/index.json');
  });

  it('should flag and remove rows that sit in another list', async () => {
    const { service } = buildStore();

    await service.ingest({
      workspaceId: 'ws',
      listId: 'old',
      name: 'Old',
      entity: 'company',
      source: 'apollo',
      rows: [company('A', 'https://a.com')],
    });
    await service.ingest({
      workspaceId: 'ws',
      listId: 'new',
      name: 'New',
      entity: 'company',
      source: 'apollo',
      rows: [company('A', 'https://a.com'), company('B', 'https://b.com')],
    });

    const outcome = await service.dedupeAgainstOtherLists('ws', 'new', {
      remove: true,
    });

    expect(outcome).toEqual({ matched: 1, removed: 1, total: 1 });
  });

  it('should cap a peek at 10 short rows', async () => {
    const { service } = buildStore();
    const rows = Array.from({ length: 30 }, (_, index) =>
      company(`Company ${index}`, `https://c${index}.com`),
    );

    await service.ingest({
      workspaceId: 'ws',
      listId: 'l1',
      name: 'List',
      entity: 'company',
      source: 'apollo',
      rows,
    });

    const document = (await service.get('ws', 'l1'))!;

    expect(service.peek(document, 0, 500)).toHaveLength(10);
  });
});

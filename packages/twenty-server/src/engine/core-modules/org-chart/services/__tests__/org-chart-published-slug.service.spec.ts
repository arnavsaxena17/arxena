import { OrgChartPublishedSlugService } from '../org-chart-published-slug.service';
import {
  ORG_CHART_PUBLISHED_INDEX_FILENAME,
  ORG_CHART_PUBLISHED_S3_FOLDER,
  orgPublishedSlugS3Filename,
  type OrgPublishedSlugManifest,
} from '../../utils/org-chart-published-slug.util';

describe('OrgChartPublishedSlugService', () => {
  const createService = () => {
    const writtenFiles = new Map<string, string>();
    const redisStore = new Map<string, unknown>();

    const fileStorageService = {
      write: jest.fn(
        async (params: {
          file: Buffer | string;
          name: string;
          folder: string;
        }) => {
          writtenFiles.set(`${params.folder}/${params.name}`, params.file.toString());
        },
      ),
      read: jest.fn(async (params: { folderPath: string; filename: string }) => {
        const key = `${params.folderPath}/${params.filename}`;
        const content = writtenFiles.get(key);

        if (!content) {
          throw new Error('File not found');
        }

        const { Readable } = require('stream');

        return Readable.from([content]);
      }),
      delete: jest.fn(async (params: { folderPath: string; filename?: string }) => {
        if (params.filename) {
          writtenFiles.delete(`${params.folderPath}/${params.filename}`);
        }
      }),
    };

    const orgChartCacheStorageService = {
      get: jest.fn(async (key: string) => redisStore.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        redisStore.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        redisStore.delete(key);
      }),
      scanKeysByLogicalPattern: jest.fn(async (pattern: string) => {
        if (pattern !== 'org-published:*') {
          return [];
        }

        return [...redisStore.keys()]
          .filter((key) => key.startsWith('org-published:'))
          .map((key) => key);
      }),
    };

    const service = new OrgChartPublishedSlugService(
      fileStorageService as never,
      orgChartCacheStorageService as never,
    );

    return {
      service,
      writtenFiles,
      redisStore,
      fileStorageService,
    };
  };

  it('reads published slug mapping from S3', async () => {
    const { service, writtenFiles } = createService();
    const manifest: OrgPublishedSlugManifest = {
      publishSlug: 'locus',
      companyId: 'locus-sh',
      companyName: 'Locus',
      workspaceId: 'workspace-1',
      publishedAt: '2026-07-11T00:00:00.000Z',
      expiresAt: null,
    };

    writtenFiles.set(
      `${ORG_CHART_PUBLISHED_S3_FOLDER}/${orgPublishedSlugS3Filename('locus')}`,
      JSON.stringify(manifest),
    );

    await expect(service.getPublishedSlugMapping('locus')).resolves.toEqual({
      companyId: 'locus-sh',
      companyName: 'Locus',
      workspaceId: 'workspace-1',
      publishedAt: '2026-07-11T00:00:00.000Z',
      expiresAt: null,
    });
  });

  it('migrates legacy Redis mapping to S3 on read', async () => {
    const { service, redisStore, writtenFiles } = createService();

    redisStore.set('org-published:stayvista', {
      companyId: 'vista-rooms',
      companyName: 'StayVista',
      workspaceId: 'workspace-1',
      publishedAt: '2026-06-27T03:54:03.000Z',
    });

    const mapping = await service.getPublishedSlugMapping('stayvista');

    expect(mapping?.companyId).toBe('vista-rooms');
    expect(
      writtenFiles.has(
        `${ORG_CHART_PUBLISHED_S3_FOLDER}/${orgPublishedSlugS3Filename('stayvista')}`,
      ),
    ).toBe(true);
    expect(
      writtenFiles.has(
        `${ORG_CHART_PUBLISHED_S3_FOLDER}/${ORG_CHART_PUBLISHED_INDEX_FILENAME}`,
      ),
    ).toBe(true);
  });

  it('savePublishedSlugMapping writes slug manifest and index to S3', async () => {
    const { service, writtenFiles } = createService();

    await service.savePublishedSlugMapping({
      publishSlug: 'dista-location-intelligence',
      mapping: {
        companyId: '51628472',
        companyName: 'Dista',
        workspaceId: 'workspace-1',
        publishedAt: '2026-07-11T00:00:00.000Z',
        expiresAt: null,
      },
      expiresAt: null,
    });

    const manifest = JSON.parse(
      writtenFiles.get(
        `${ORG_CHART_PUBLISHED_S3_FOLDER}/${orgPublishedSlugS3Filename('dista-location-intelligence')}`,
      ) ?? '{}',
    ) as OrgPublishedSlugManifest;

    expect(manifest.companyId).toBe('51628472');
    expect(manifest.publishSlug).toBe('dista-location-intelligence');

    const index = JSON.parse(
      writtenFiles.get(
        `${ORG_CHART_PUBLISHED_S3_FOLDER}/${ORG_CHART_PUBLISHED_INDEX_FILENAME}`,
      ) ?? '{}',
    );

    expect(index.slugs).toContain('dista-location-intelligence');
  });
});

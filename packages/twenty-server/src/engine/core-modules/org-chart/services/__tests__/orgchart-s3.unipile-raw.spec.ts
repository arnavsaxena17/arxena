import {
  ORG_CHART_UNIPILE_RAW_S3_VARIANT,
  ORG_CHART_UNIPILE_RAW_SEARCH_FILENAME,
} from 'src/engine/core-modules/org-chart/types/orgchart-unipile-raw-search.types';
import { OrgChartS3Service } from 'src/engine/core-modules/org-chart/services/orgchart-s3.service';

describe('OrgChartS3Service Unipile raw search', () => {
  it('saves and loads Unipile raw search under the unipile_raw variant', async () => {
    const writes: Array<{ folder: string; name: string; file: Buffer }> = [];
    const payload = {
      version: 1 as const,
      savedAt: '2026-09-04T08:27:52.000Z',
      searchType: 'sales_navigator' as const,
      itemCount: 1,
      items: [{ id: 'ACwAA', name: 'Raw Person' }],
    };

    const fileStorageService = {
      write: jest.fn(async (input: {
        folder: string;
        name: string;
        file: Buffer;
      }) => {
        writes.push(input);
      }),
      read: jest.fn(async () => {
        const { Readable } = await import('stream');
        return Readable.from([Buffer.from(JSON.stringify(payload))]);
      }),
    };

    const service = new OrgChartS3Service(
      fileStorageService as never,
      { ingestOrgChartData: jest.fn(), ingestBatch: jest.fn() } as never,
    );

    await service.saveUnipileRawSearch('british-airways', payload);

    expect(writes).toHaveLength(1);
    expect(writes[0]?.folder).toBe(
      `org-charts/british_airways/${ORG_CHART_UNIPILE_RAW_S3_VARIANT}`,
    );
    expect(writes[0]?.name).toBe(ORG_CHART_UNIPILE_RAW_SEARCH_FILENAME);

    const loaded = await service.getUnipileRawSearch('british-airways');
    expect(loaded?.itemCount).toBe(1);
    expect(loaded?.items[0]).toEqual({ id: 'ACwAA', name: 'Raw Person' });
  });

  it('returns null when Unipile raw search is missing or empty', async () => {
    const fileStorageService = {
      read: jest.fn(async () => {
        throw new Error('File not found');
      }),
    };

    const service = new OrgChartS3Service(
      fileStorageService as never,
      { ingestOrgChartData: jest.fn(), ingestBatch: jest.fn() } as never,
    );

    await expect(service.getUnipileRawSearch('missing-co')).resolves.toBeNull();
  });
});

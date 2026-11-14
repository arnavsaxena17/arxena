import { type LinkedInSearchResult } from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-response.type';

import { type OrgchartStrategyResult } from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';
import {
  extractRawLinkedInItems,
  persistRawSnapshot,
} from 'src/domains/org-graph/org-chart/build/services/orgchart-unipile-raw-snapshot.util';

const item = (fields: Record<string, unknown>): LinkedInSearchResult =>
  fields as unknown as LinkedInSearchResult;

const strategyResult = (
  items: LinkedInSearchResult[],
): OrgchartStrategyResult => ({
  strategy: { id: 's1' } as OrgchartStrategyResult['strategy'],
  result: { itemCount: items.length, searchResults: { items } },
});

const snapshotS3 = (folderKey = 'acme_co/') => ({
  persistedCompanyFolderKey: jest.fn(() => folderKey),
  saveUnipileRawSearch: jest.fn(async () => undefined),
});

type SnapshotDeps = Parameters<typeof persistRawSnapshot>[0];

describe('extractRawLinkedInItems', () => {
  it('should keep one item per public identifier across strategies', () => {
    const jane = item({ public_identifier: 'jane' });
    const john = item({ id: 'john' });

    expect(
      extractRawLinkedInItems([
        strategyResult([jane, john]),
        strategyResult([item({ public_identifier: 'jane' })]),
      ]),
    ).toEqual([jane, john]);
  });

  it('should fall back to the id and then the name', () => {
    const byId = item({ id: 'p1' });
    const byName = item({ name: 'Asha Rao' });

    expect(
      extractRawLinkedInItems([
        strategyResult([byId, byName, item({ id: 'p1' })]),
      ]),
    ).toEqual([byId, byName]);
  });

  it('should leave out an item with no identifier', () => {
    expect(
      extractRawLinkedInItems([strategyResult([item({ headline: 'Anon' })])]),
    ).toEqual([]);
  });
});

describe('persistRawSnapshot', () => {
  it('should not write when the company has no folder key', async () => {
    const s3 = snapshotS3('');

    await persistRawSnapshot(s3 as unknown as SnapshotDeps, {
      strategyResults: [strategyResult([item({ id: 'p1' })])],
      searchType: 'classic',
      companyName: 'Acme',
    });

    expect(s3.saveUnipileRawSearch).not.toHaveBeenCalled();
  });

  it('should not write when no page returned raw items', async () => {
    const s3 = snapshotS3();

    await persistRawSnapshot(s3 as unknown as SnapshotDeps, {
      strategyResults: [strategyResult([])],
      searchType: 'classic',
      companyName: 'Acme',
    });

    expect(s3.saveUnipileRawSearch).not.toHaveBeenCalled();
  });

  it('should save the payload under the company folder with its item count', async () => {
    const s3 = snapshotS3('acme_co/');
    const jane = item({ public_identifier: 'jane' });

    await persistRawSnapshot(s3 as unknown as SnapshotDeps, {
      strategyResults: [strategyResult([jane])],
      searchType: 'sales_navigator',
      companyId: 'acme',
      companyName: 'Acme',
      mode: 'entire_company',
      functionRoot: 'Sales',
      country: 'india',
      requestId: 'req-1',
    });

    expect(s3.saveUnipileRawSearch).toHaveBeenCalledWith(
      'acme_co/',
      expect.objectContaining({
        version: 1,
        companyId: 'acme',
        companyName: 'Acme',
        searchType: 'sales_navigator',
        mode: 'entire_company',
        functionRoot: 'Sales',
        country: 'india',
        requestId: 'req-1',
        itemCount: 1,
        items: [jane],
      }),
    );
  });
});

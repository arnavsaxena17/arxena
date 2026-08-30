import { type EntityManager } from 'typeorm';

import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatPageLayout } from 'src/engine/metadata-modules/flat-page-layout/types/flat-page-layout.type';
import {
  OUTREACH_DASHBOARD_ID,
  OUTREACH_DASHBOARD_TITLE,
  getOutreachDashboardPageLayoutUniversalIdentifier,
} from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-page-layout.util';
import { prefillOutreachDashboard } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-dashboards.util';

const LIVE_LAYOUT_ID = 'af1b90bb-ce55-4da1-af8b-8f9e723321f2';
const STALE_LAYOUT_ID = '558e895e-91ea-4194-8f53-f0e92ce4a04f';

const createFlatPageLayoutMaps = (): FlatEntityMaps<FlatPageLayout> => {
  const universalIdentifier =
    getOutreachDashboardPageLayoutUniversalIdentifier();

  return {
    byId: {
      [LIVE_LAYOUT_ID]: {
        id: LIVE_LAYOUT_ID,
        universalIdentifier,
      } as FlatPageLayout,
    },
    byUniversalIdentifier: {
      [universalIdentifier]: {
        id: LIVE_LAYOUT_ID,
        universalIdentifier,
      } as FlatPageLayout,
    },
    idByUniversalIdentifier: {
      [universalIdentifier]: LIVE_LAYOUT_ID,
    },
    universalIdentifiersByApplicationId: {},
  };
};

describe('prefillOutreachDashboard', () => {
  it('should heal pageLayoutId when an Outreach dashboard points at a stale layout', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: OUTREACH_DASHBOARD_ID,
          title: OUTREACH_DASHBOARD_TITLE,
          pageLayoutId: STALE_LAYOUT_ID,
        },
      ])
      .mockResolvedValueOnce(undefined);

    const entityManager = { query } as unknown as EntityManager;

    const result = await prefillOutreachDashboard({
      entityManager,
      schemaName: 'workspace_test',
      flatPageLayoutMaps: createFlatPageLayoutMaps(),
    });

    expect(result).toBe('healed-page-layout-id');
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE workspace_test.dashboard'),
      [OUTREACH_DASHBOARD_ID, OUTREACH_DASHBOARD_TITLE, LIVE_LAYOUT_ID],
    );
  });

  it('should skip when Outreach dashboard already points at the live layout', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        id: OUTREACH_DASHBOARD_ID,
        title: OUTREACH_DASHBOARD_TITLE,
        pageLayoutId: LIVE_LAYOUT_ID,
      },
    ]);

    const entityManager = { query } as unknown as EntityManager;

    const result = await prefillOutreachDashboard({
      entityManager,
      schemaName: 'workspace_test',
      flatPageLayoutMaps: createFlatPageLayoutMaps(),
    });

    expect(result).toBe('skipped-exists');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

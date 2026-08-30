import { FieldActorSource } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type EntityManager } from 'typeorm';

import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { type FlatPageLayout } from 'src/engine/metadata-modules/flat-page-layout/types/flat-page-layout.type';
import {
  OUTREACH_DASHBOARD_ID,
  OUTREACH_DASHBOARD_TITLE,
  getOutreachDashboardPageLayoutUniversalIdentifier,
} from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-page-layout.util';
import { STANDARD_PAGE_LAYOUTS } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-page-layout.constant';

export const MY_FIRST_DASHBOARD_ID = 'f31ecf3b-87d3-4e8a-a84b-b6f0f3f8c7e2';

const DASHBOARD_INSERT_COLUMNS = [
  'id',
  'title',
  'pageLayoutId',
  'position',
  'createdBySource',
  'createdByWorkspaceMemberId',
  'createdByName',
  'createdByContext',
  'updatedBySource',
  'updatedByWorkspaceMemberId',
  'updatedByName',
  'updatedByContext',
] as const;

const insertDashboardRecord = async ({
  entityManager,
  schemaName,
  id,
  title,
  pageLayoutId,
  position,
}: {
  entityManager: EntityManager;
  schemaName: string;
  id: string;
  title: string;
  pageLayoutId: string;
  position: number;
}) => {
  await entityManager
    .createQueryBuilder()
    .insert()
    .into(`${schemaName}.dashboard`, [...DASHBOARD_INSERT_COLUMNS])
    .orIgnore()
    .values([
      {
        id,
        title,
        pageLayoutId,
        position,
        createdBySource: FieldActorSource.SYSTEM,
        createdByWorkspaceMemberId: null,
        createdByName: 'System',
        createdByContext: {},
        updatedBySource: FieldActorSource.SYSTEM,
        updatedByWorkspaceMemberId: null,
        updatedByName: 'System',
        updatedByContext: {},
      },
    ])
    .execute();
};

export const prefillOutreachDashboard = async ({
  entityManager,
  schemaName,
  flatPageLayoutMaps,
}: {
  entityManager: EntityManager;
  schemaName: string;
  flatPageLayoutMaps: FlatEntityMaps<FlatPageLayout>;
}): Promise<
  | 'inserted'
  | 'skipped-exists'
  | 'healed-page-layout-id'
  | 'skipped-missing-layout'
> => {
  const outreachPageLayout = findFlatEntityByUniversalIdentifier({
    flatEntityMaps: flatPageLayoutMaps,
    universalIdentifier: getOutreachDashboardPageLayoutUniversalIdentifier(),
  });

  if (!isDefined(outreachPageLayout)) {
    return 'skipped-missing-layout';
  }

  const existing = (await entityManager.query(
    `
      SELECT id, title, "pageLayoutId"
      FROM ${schemaName}.dashboard
      WHERE title = ANY($1)
        AND "deletedAt" IS NULL
      LIMIT 1
    `,
    [[OUTREACH_DASHBOARD_TITLE, 'Outreach Command']],
  )) as Array<{ id: string; title: string; pageLayoutId: string | null }>;

  if (existing.length > 0) {
    const existingDashboard = existing[0];
    const shouldRenameTitle =
      existingDashboard.title !== OUTREACH_DASHBOARD_TITLE;
    const shouldHealPageLayoutId =
      existingDashboard.pageLayoutId !== outreachPageLayout.id;

    if (shouldRenameTitle || shouldHealPageLayoutId) {
      await entityManager.query(
        `
          UPDATE ${schemaName}.dashboard
          SET title = $2,
              "pageLayoutId" = $3,
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [
          existingDashboard.id,
          OUTREACH_DASHBOARD_TITLE,
          outreachPageLayout.id,
        ],
      );

      return 'healed-page-layout-id';
    }

    return 'skipped-exists';
  }

  await insertDashboardRecord({
    entityManager,
    schemaName,
    id: OUTREACH_DASHBOARD_ID,
    title: OUTREACH_DASHBOARD_TITLE,
    pageLayoutId: outreachPageLayout.id,
    position: 1,
  });

  return 'inserted';
};

export const prefillDashboards = async (
  entityManager: EntityManager,
  schemaName: string,
  flatPageLayoutMaps: FlatEntityMaps<FlatPageLayout>,
) => {
  const myFirstDashboardPageLayout = findFlatEntityByUniversalIdentifier({
    flatEntityMaps: flatPageLayoutMaps,
    universalIdentifier:
      STANDARD_PAGE_LAYOUTS.myFirstDashboard.universalIdentifier,
  });

  if (!isDefined(myFirstDashboardPageLayout)) {
    throw new Error(
      `Page layout with universalIdentifier '${STANDARD_PAGE_LAYOUTS.myFirstDashboard.universalIdentifier}' not found`,
    );
  }

  await insertDashboardRecord({
    entityManager,
    schemaName,
    id: MY_FIRST_DASHBOARD_ID,
    title: 'My First Dashboard',
    pageLayoutId: myFirstDashboardPageLayout.id,
    position: 0,
  });

  const gtmCommandResult = await prefillOutreachDashboard({
    entityManager,
    schemaName,
    flatPageLayoutMaps,
  });

  if (gtmCommandResult === 'skipped-missing-layout') {
    throw new Error(
      `Page layout with universalIdentifier '${getOutreachDashboardPageLayoutUniversalIdentifier()}' not found`,
    );
  }
};

import { type EntityManager } from 'typeorm';

import { OUTREACH_WORKFLOW_NAMES_TO_DEACTIVATE } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

const tableExists = async ({
  schemaName,
  tableName,
  entityManager,
}: {
  schemaName: string;
  tableName: string;
  entityManager: EntityManager;
}) => {
  const rows = (await entityManager.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_name = $2
      LIMIT 1
    `,
    [schemaName, tableName],
  )) as unknown[];

  return rows.length > 0;
};

export const deactivateOutreachWorkflowsByName = async ({
  schemaName,
  entityManager,
  workflowNames,
}: {
  schemaName: string;
  entityManager: EntityManager;
  workflowNames: readonly string[];
}) => {
  if (workflowNames.length === 0) {
    return { workflowIds: [] as string[] };
  }

  const retired = (await entityManager.query(
    `
      SELECT id, "coreWorkflowId"
      FROM ${schemaName}.workflow
      WHERE name = ANY($1)
        AND "deletedAt" IS NULL
    `,
    [workflowNames],
  )) as Array<{ id: string; coreWorkflowId: string | null }>;

  if (retired.length === 0) {
    return { workflowIds: [] as string[] };
  }

  const workflowIds = retired.map((row) => row.id);
  const coreWorkflowIds = retired
    .map((row) => row.coreWorkflowId)
    .filter((id): id is string => typeof id === 'string');

  if (await tableExists({ schemaName, tableName: 'project', entityManager })) {
    const projectColumns = (await entityManager.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'project'
          AND column_name = 'outreachWorkflowId'
      `,
      [schemaName],
    )) as Array<{ column_name: string }>;

    if (projectColumns.length > 0) {
      await entityManager.query(
        `
          UPDATE ${schemaName}.project
          SET "outreachWorkflowId" = NULL, "updatedAt" = NOW()
          WHERE "outreachWorkflowId" = ANY($1)
        `,
        [workflowIds],
      );
    }
  }

  await entityManager.query(
    `
      DELETE FROM ${schemaName}."workflowAutomatedTrigger"
      WHERE "workflowId" = ANY($1)
    `,
    [workflowIds],
  );

  await entityManager.query(
    `
      UPDATE ${schemaName}."workflowRun"
      SET "deletedAt" = COALESCE("deletedAt", NOW()), "updatedAt" = NOW()
      WHERE "workflowId" = ANY($1)
        AND "deletedAt" IS NULL
    `,
    [workflowIds],
  );

  await entityManager.query(
    `
      UPDATE ${schemaName}."workflowVersion"
      SET status = 'DEACTIVATED',
          "deletedAt" = COALESCE("deletedAt", NOW()),
          "updatedAt" = NOW()
      WHERE "workflowId" = ANY($1)
        AND "deletedAt" IS NULL
    `,
    [workflowIds],
  );

  await entityManager.query(
    `
      UPDATE ${schemaName}.workflow
      SET statuses = ARRAY['DEACTIVATED']::${schemaName}.workflow_statuses_enum[],
          "lastPublishedVersionId" = NULL,
          "deletedAt" = COALESCE("deletedAt", NOW()),
          "updatedAt" = NOW()
      WHERE id = ANY($1)
        AND "deletedAt" IS NULL
    `,
    [workflowIds],
  );

  if (coreWorkflowIds.length > 0) {
    await entityManager.query(
      `
        DELETE FROM core."workflowVersion"
        WHERE "workflowId" = ANY($1)
      `,
      [coreWorkflowIds],
    );

    await entityManager.query(
      `
        DELETE FROM core.workflow
        WHERE id = ANY($1)
      `,
      [coreWorkflowIds],
    );
  }

  return { workflowIds };
};

export const deactivateObsoleteOutreachWorkflows = async ({
  schemaName,
  entityManager,
}: {
  schemaName: string;
  entityManager: EntityManager;
}) =>
  deactivateOutreachWorkflowsByName({
    schemaName,
    entityManager,
    workflowNames: OUTREACH_WORKFLOW_NAMES_TO_DEACTIVATE,
  });

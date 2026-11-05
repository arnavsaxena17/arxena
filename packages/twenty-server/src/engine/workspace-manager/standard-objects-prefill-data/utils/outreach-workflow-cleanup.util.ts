import { type EntityManager } from 'typeorm';

import {
  OUTREACH_WORKFLOW_NAMES_TO_DEACTIVATE,
  SEEDED_OUTREACH_WORKFLOW,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

type RetiredWorkflow = { id: string; coreWorkflowId: string | null };

// Custom-object workspaces store Project as `_project`, older ones as `project`.
const resolveProjectTableWithOutreachWorkflowId = async ({
  schemaName,
  entityManager,
}: {
  schemaName: string;
  entityManager: EntityManager;
}): Promise<string | null> => {
  const rows = (await entityManager.query(
    `
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name IN ('project', '_project')
        AND column_name = 'outreachWorkflowId'
      LIMIT 1
    `,
    [schemaName],
  )) as Array<{ table_name: string }>;

  return rows[0]?.table_name ?? null;
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

  return deactivateOutreachWorkflowsByIds({
    schemaName,
    entityManager,
    workflows: retired,
  });
};

export const deactivateOutreachWorkflowsByIds = async ({
  schemaName,
  entityManager,
  workflows,
  replacementWorkflowId = null,
}: {
  schemaName: string;
  entityManager: EntityManager;
  workflows: readonly RetiredWorkflow[];
  // Projects pinned to a retired workflow move here; null unpins them.
  replacementWorkflowId?: string | null;
}) => {
  if (workflows.length === 0) {
    return { workflowIds: [] as string[] };
  }

  const workflowIds = workflows.map((row) => row.id);
  const coreWorkflowIds = workflows
    .map((row) => row.coreWorkflowId)
    .filter((id): id is string => typeof id === 'string');

  const projectTable = await resolveProjectTableWithOutreachWorkflowId({
    schemaName,
    entityManager,
  });

  if (projectTable !== null) {
    await entityManager.query(
      `
        UPDATE ${schemaName}."${projectTable}"
        SET "outreachWorkflowId" = $2, "updatedAt" = NOW()
        WHERE "outreachWorkflowId" = ANY($1)
      `,
      [workflowIds, replacementWorkflowId],
    );
  }

  // Soft-deleting a run does not halt it; mark in-flight runs stopped first.
  await entityManager.query(
    `
      UPDATE ${schemaName}."workflowRun"
      SET status = 'STOPPED', "updatedAt" = NOW()
      WHERE "workflowId" = ANY($1)
        AND status IN ('NOT_STARTED', 'ENQUEUED', 'RUNNING', 'STOPPING')
    `,
    [workflowIds],
  );

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

// Keeps exactly one "Outreach — Candidate Sequencer": the seeded workflow
// (deterministic id), else the oldest. Copies — e.g. ones the Outreach page
// used to create client-side — share the name, so name-based resyncs rewrote
// and activated them too, and every candidate update fired both sequencers.
export const retireDuplicateOutreachSequencerWorkflows = async ({
  schemaName,
  entityManager,
  seededSequencerWorkflowId,
}: {
  schemaName: string;
  entityManager: EntityManager;
  seededSequencerWorkflowId: string;
}) => {
  const sequencers = (await entityManager.query(
    `
      SELECT id, "coreWorkflowId"
      FROM ${schemaName}.workflow
      WHERE name = $1
        AND "deletedAt" IS NULL
      ORDER BY (id = $2) DESC, "createdAt" ASC, id ASC
    `,
    [
      SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
      seededSequencerWorkflowId,
    ],
  )) as RetiredWorkflow[];

  const [keeper, ...duplicates] = sequencers;

  if (keeper === undefined || duplicates.length === 0) {
    return { keptWorkflowId: keeper?.id ?? null, workflowIds: [] as string[] };
  }

  const { workflowIds } = await deactivateOutreachWorkflowsByIds({
    schemaName,
    entityManager,
    workflows: duplicates,
    replacementWorkflowId: keeper.id,
  });

  return { keptWorkflowId: keeper.id, workflowIds };
};

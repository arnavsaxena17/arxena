import { randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type EntityManager } from 'typeorm';

// Copies DATABASE_EVENT trigger settings from a workflowVersion onto the
// live workflowAutomatedTrigger row the runtime listener actually reads.
export const syncWorkflowAutomatedTriggerFromVersion = async ({
  schemaName,
  entityManager,
  workflowId,
  versionId,
}: {
  schemaName: string;
  entityManager: EntityManager;
  workflowId: string;
  versionId: string;
}): Promise<{ eventName: string; fields: string[] }> => {
  const versionRows = (await entityManager.query(
    `
      SELECT id, trigger
      FROM ${schemaName}."workflowVersion"
      WHERE id = $1
        AND "deletedAt" IS NULL
      LIMIT 1
    `,
    [versionId],
  )) as Array<{
    id: string;
    trigger: {
      type?: string;
      settings?: {
        eventName?: string;
        fields?: string[];
        filter?: unknown;
      };
    } | null;
  }>;

  const version = versionRows[0];

  if (!isDefined(version)) {
    throw new Error(`Workflow version ${versionId} not found`);
  }

  if (version.trigger?.type !== 'DATABASE_EVENT') {
    throw new Error(
      `Workflow version ${versionId} trigger type is ${String(version.trigger?.type)}, expected DATABASE_EVENT`,
    );
  }

  const eventName = version.trigger.settings?.eventName;
  const fields = version.trigger.settings?.fields ?? [];
  const filter = version.trigger.settings?.filter;

  if (!isNonEmptyString(eventName)) {
    throw new Error(
      `Workflow version ${versionId} is missing DATABASE_EVENT eventName`,
    );
  }

  const settings: Record<string, unknown> = { eventName };

  if (fields.length > 0) {
    settings.fields = fields;
  }

  if (isDefined(filter)) {
    settings.filter = filter;
  }

  await entityManager.query(
    `
      DELETE FROM ${schemaName}."workflowAutomatedTrigger"
      WHERE "workflowId" = $1
    `,
    [workflowId],
  );

  await entityManager.query(
    `
      INSERT INTO ${schemaName}."workflowAutomatedTrigger"
        (id, "workflowId", type, settings, "createdAt", "updatedAt")
      VALUES ($1, $2, 'DATABASE_EVENT', $3::jsonb, NOW(), NOW())
    `,
    [randomUUID(), workflowId, JSON.stringify(settings)],
  );

  return { eventName, fields };
};

export const sequencerAutomatedTriggerLooksHealthy = ({
  fields,
  filterJson,
}: {
  fields: string[];
  filterJson: string;
}): boolean =>
  fields.includes('candidateFlags') &&
  fields.includes('outreachSequenceStage') &&
  filterJson.includes('candidateFlags.startOutreach') &&
  filterJson.includes('candidateFlags.stopOutreach') &&
  !filterJson.includes('after.startOutreach') &&
  !filterJson.includes('after.stopOutreach');

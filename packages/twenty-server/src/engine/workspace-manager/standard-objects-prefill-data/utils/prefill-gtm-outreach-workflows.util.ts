import { FieldActorSource } from 'twenty-shared/types';
import { AUTO_SELECT_SMART_MODEL_ID } from 'twenty-shared/constants';
import { type EntityManager } from 'typeorm';
import { v5 } from 'uuid';

import { getGtmOutreachLogicFunctionIds } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-gtm-logic-functions.util';
import { GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES } from 'src/engine/workspace-manager/standard-objects-prefill-data/data/gtm-outreach-workflow-graphs';
import {
  GTM_WF_AGENT_EMAIL,
  GTM_WF_AGENT_LINKEDIN,
  GTM_WF_AGENT_REPLY,
  GTM_WF_FIELD,
  GTM_WF_HARVEST_PROJECT_ID,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/data/gtm-outreach-workflow-graph-helpers';

const GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE =
  'c8e4d2b1-7a90-4f33-9e16-5b0c8a1d4e72';

const GRAPH_SLUGS: Record<string, string> = {
  'GTM Harvest — LinkedIn Companies': 'harvest',
  'Company Created → ICP People Search': 'companySearch',
  'GTM Outreach — Per Candidate': 'perCandidate',
  'GTM Outreach — Connection Accepted': 'connectionAccepted',
  'GTM Outreach — Reply': 'reply',
  'GTM Outreach — Negotiating': 'negotiating',
  'GTM Outreach — Deferred': 'deferred',
  'GTM Outreach — Meeting Booked': 'meetingBooked',
};

const LF_TOKEN_TO_ID_KEY = {
  '__LF_search-people-for-company__': 'searchPeopleForCompanyId',
  '__LF_upload-profiles__': 'uploadProfilesId',
  '__LF_search-companies__': 'searchCompaniesId',
  '__LF_upsert-companies__': 'upsertCompaniesId',
  '__LF_enrich-contact__': 'enrichContactId',
  '__LF_get-calendar-availability__': 'getCalendarAvailabilityId',
  '__LF_fetch-linkedin-messages__': 'fetchLinkedinMessagesId',
  '__LF_fetch-linkedin-profile__': 'fetchLinkedinProfileId',
} as const;

const LINKEDIN_MESSAGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' as const, description: 'LinkedIn message body' },
  },
  required: ['message'],
  additionalProperties: false as const,
};

const FALLBACK_EMAIL_SCHEMA = {
  type: 'object' as const,
  properties: {
    subject: { type: 'string' as const, description: 'Email subject' },
    message: { type: 'string' as const, description: 'Email body' },
  },
  required: ['subject', 'message'],
  additionalProperties: false as const,
};

const REPLY_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' as const, description: 'Reply body' },
  },
  required: ['message'],
  additionalProperties: false as const,
};

export const getGtmOutreachWorkflowPrefillIds = (workspaceId: string) => {
  const ids: Record<
    string,
    {
      workflowId: string;
      workflowVersionId: string;
      coreWorkflowId: string;
      coreWorkflowVersionId: string;
      workflowUniversalIdentifier: string;
      workflowVersionUniversalIdentifier: string;
    }
  > = {};

  for (const slug of Object.values(GRAPH_SLUGS)) {
    ids[slug] = {
      workflowId: v5(
        `gtmOutreachWorkflow:${slug}:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
      workflowVersionId: v5(
        `gtmOutreachWorkflowVersion:${slug}:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
      coreWorkflowId: v5(
        `gtmOutreachCoreWorkflow:${slug}:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
      coreWorkflowVersionId: v5(
        `gtmOutreachCoreWorkflowVersion:${slug}:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
      workflowUniversalIdentifier: v5(
        `gtmOutreachWorkflowUniversalIdentifier:${slug}:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
      workflowVersionUniversalIdentifier: v5(
        `gtmOutreachWorkflowVersionUniversalIdentifier:${slug}:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
    };
  }

  return ids;
};

export const getGtmOutreachAgentIds = (workspaceId: string) => ({
  linkedinMessage: v5(
    `gtmOutreachAgent:linkedinMessage:${workspaceId}`,
    GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
  ),
  fallbackEmail: v5(
    `gtmOutreachAgent:fallbackEmail:${workspaceId}`,
    GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
  ),
  reply: v5(
    `gtmOutreachAgent:reply:${workspaceId}`,
    GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
  ),
});

export const getGtmHarvestProjectId = (workspaceId: string) =>
  v5(`gtmHarvestProject:${workspaceId}`, GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE);

const loadFieldMetadataId = async ({
  entityManager,
  workspaceId,
  objectName,
  fieldNames,
}: {
  entityManager: EntityManager;
  workspaceId: string;
  objectName: string;
  fieldNames: string[];
}): Promise<string> => {
  const rows = (await entityManager.query(
    `
      SELECT fm.id, fm.name
      FROM core."fieldMetadata" fm
      INNER JOIN core."objectMetadata" om ON om.id = fm."objectMetadataId"
      WHERE om."workspaceId" = $1
        AND om."nameSingular" = $2
        AND fm.name = ANY($3)
    `,
    [workspaceId, objectName, fieldNames],
  )) as Array<{ id: string; name: string }>;

  const preferred = fieldNames
    .map((name) => rows.find((row) => row.name === name)?.id)
    .find((id): id is string => Boolean(id));

  if (!preferred) {
    throw new Error(
      `Missing field metadata for ${objectName}.${fieldNames.join('|')} in workspace ${workspaceId}`,
    );
  }

  return preferred;
};

const substituteTokens = (
  value: unknown,
  replacements: Record<string, string>,
): unknown => {
  let serialized = JSON.stringify(value);

  for (const [token, replacement] of Object.entries(replacements)) {
    serialized = serialized.split(token).join(replacement);
  }

  if (serialized.includes('__LF_') || serialized.includes('__AGENT_') || serialized.includes('__PROJECT_') || serialized.includes('__FIELD_')) {
    throw new Error(
      'Unresolved GTM outreach workflow token in prefill',
    );
  }

  return JSON.parse(serialized);
};

const upsertAgents = async ({
  entityManager,
  workspaceId,
  applicationId,
}: {
  entityManager: EntityManager;
  workspaceId: string;
  applicationId: string;
}) => {
  const agentIds = getGtmOutreachAgentIds(workspaceId);
  const agents = [
    {
      id: agentIds.linkedinMessage,
      name: 'gtm-outreach-linkedin-message',
      label: 'GTM LinkedIn message',
      prompt:
        'You draft short LinkedIn messages for GTM outreach. Return JSON { "message": "<body>" } only.',
      responseFormat: { type: 'json', schema: LINKEDIN_MESSAGE_SCHEMA },
      universalIdentifier: v5(
        `gtmOutreachAgentUniversal:linkedinMessage:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
    },
    {
      id: agentIds.fallbackEmail,
      name: 'gtm-outreach-fallback-email',
      label: 'GTM fallback email',
      prompt:
        'You draft short ICP-aligned emails when LinkedIn connect is ignored. Return JSON { "subject", "message" } only. Do not invent LinkedIn facts.',
      responseFormat: { type: 'json', schema: FALLBACK_EMAIL_SCHEMA },
      universalIdentifier: v5(
        `gtmOutreachAgentUniversal:fallbackEmail:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
    },
    {
      id: agentIds.reply,
      name: 'gtm-outreach-reply',
      label: 'GTM inbound reply',
      prompt:
        'You draft short GTM replies after inbound classification. Return JSON { "message": "<body>" } only. Never invent calendar times.',
      responseFormat: { type: 'json', schema: REPLY_SCHEMA },
      universalIdentifier: v5(
        `gtmOutreachAgentUniversal:reply:${workspaceId}`,
        GTM_OUTREACH_WORKFLOW_PREFILL_ID_NAMESPACE,
      ),
    },
  ];

  const resolved = { ...agentIds };

  for (const agent of agents) {
    const existing = (await entityManager.query(
      `
        SELECT id FROM core.agent
        WHERE name = $1 AND "workspaceId" = $2 AND "deletedAt" IS NULL
        LIMIT 1
      `,
      [agent.name, workspaceId],
    )) as Array<{ id: string }>;

    if (existing[0]?.id) {
      resolved[
        agent.name === 'gtm-outreach-linkedin-message'
          ? 'linkedinMessage'
          : agent.name === 'gtm-outreach-fallback-email'
            ? 'fallbackEmail'
            : 'reply'
      ] = existing[0].id;

      await entityManager.query(
        `
          UPDATE core.agent
          SET prompt = $2,
              "responseFormat" = $3::jsonb,
              label = $4
          WHERE id = $1
        `,
        [
          existing[0].id,
          agent.prompt,
          JSON.stringify(agent.responseFormat),
          agent.label,
        ],
      );

      continue;
    }

    await entityManager.query(
      `
        INSERT INTO core.agent (
          id, name, label, icon, description, prompt, "modelId",
          "responseFormat", "isCustom", "workspaceId", "universalIdentifier",
          "applicationId", "evaluationInputs"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true, $9, $10, $11, '{}')
      `,
      [
        agent.id,
        agent.name,
        agent.label,
        'IconRobot',
        agent.label,
        agent.prompt,
        AUTO_SELECT_SMART_MODEL_ID,
        JSON.stringify(agent.responseFormat),
        workspaceId,
        agent.universalIdentifier,
        applicationId,
      ],
    );
  }

  return resolved;
};

const resolveWorkspaceTableName = async ({
  entityManager,
  schemaName,
  nameSingular,
}: {
  entityManager: EntityManager;
  schemaName: string;
  nameSingular: string;
}): Promise<string> => {
  const rows = (await entityManager.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = $1
        AND tablename IN ($2, $3)
      LIMIT 1
    `,
    [schemaName, nameSingular, `_${nameSingular}`],
  )) as Array<{ tablename: string }>;

  if (!rows[0]?.tablename) {
    throw new Error(
      `Workspace table for ${nameSingular} not found in ${schemaName}`,
    );
  }

  return rows[0].tablename;
};

const tableHasColumn = async ({
  entityManager,
  schemaName,
  tableName,
  columnName,
}: {
  entityManager: EntityManager;
  schemaName: string;
  tableName: string;
  columnName: string;
}): Promise<boolean> => {
  const rows = (await entityManager.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = $3
      LIMIT 1
    `,
    [schemaName, tableName, columnName],
  )) as Array<{ '?column?': number }>;

  return rows.length > 0;
};

const upsertHarvestProject = async ({
  entityManager,
  schemaName,
  workspaceId,
  outreachWorkflowId,
}: {
  entityManager: EntityManager;
  schemaName: string;
  workspaceId: string;
  outreachWorkflowId: string;
}) => {
  const projectId = getGtmHarvestProjectId(workspaceId);
  const tableName = await resolveWorkspaceTableName({
    entityManager,
    schemaName,
    nameSingular: 'project',
  });
  const quotedTable = `${schemaName}."${tableName}"`;
  const hasGtmRunKey = await tableHasColumn({
    entityManager,
    schemaName,
    tableName,
    columnName: 'gtmRunKey',
  });
  const hasOutreachWorkflowId = await tableHasColumn({
    entityManager,
    schemaName,
    tableName,
    columnName: 'outreachWorkflowId',
  });

  const columns = ['id', 'name', 'createdBySource', 'createdByWorkspaceMemberId', 'createdByName', 'updatedBySource', 'updatedByWorkspaceMemberId', 'updatedByName'];
  const values: unknown[] = [
    projectId,
    'GTM Harvest',
    FieldActorSource.SYSTEM,
    null,
    'System',
    FieldActorSource.SYSTEM,
    null,
    'System',
  ];

  if (hasGtmRunKey) {
    columns.splice(2, 0, 'gtmRunKey');
    values.splice(2, 0, projectId);
  }

  if (hasOutreachWorkflowId) {
    const insertAt = hasGtmRunKey ? 3 : 2;
    columns.splice(insertAt, 0, 'outreachWorkflowId');
    values.splice(insertAt, 0, outreachWorkflowId);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const quotedColumns = columns.map((column) =>
    column === 'id' || column === 'name' ? column : `"${column}"`,
  );
  const updateSet = [
    hasOutreachWorkflowId
      ? `"outreachWorkflowId" = EXCLUDED."outreachWorkflowId"`
      : null,
    hasGtmRunKey ? `"gtmRunKey" = EXCLUDED."gtmRunKey"` : null,
    `name = EXCLUDED.name`,
  ]
    .filter(Boolean)
    .join(', ');

  await entityManager.query(
    `
      INSERT INTO ${quotedTable} (${quotedColumns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updateSet}
    `,
    values,
  );

  return projectId;
};

export const prefillGtmOutreachWorkflows = async ({
  entityManager,
  workspaceId,
  schemaName,
  applicationId,
  replaceExistingDrafts = false,
}: {
  entityManager: EntityManager;
  workspaceId: string;
  schemaName: string;
  applicationId: string;
  replaceExistingDrafts?: boolean;
}) => {
  const prefillIds = getGtmOutreachWorkflowPrefillIds(workspaceId);
  const lfIds = getGtmOutreachLogicFunctionIds(workspaceId);
  const agentIds = await upsertAgents({
    entityManager,
    workspaceId,
    applicationId,
  });

  const candidateIdFieldId = await loadFieldMetadataId({
    entityManager,
    workspaceId,
    objectName: 'candidate',
    fieldNames: ['id'],
  });
  const profileMemberFieldId = await loadFieldMetadataId({
    entityManager,
    workspaceId,
    objectName: 'workspaceMemberProfile',
    fieldNames: ['workspaceMemberId', 'workspaceMember'],
  });
  const chatCandidateFieldId = await loadFieldMetadataId({
    entityManager,
    workspaceId,
    objectName: 'chatMessage',
    fieldNames: ['candidateId', 'candidate'],
  });

  const harvestProjectId = await upsertHarvestProject({
    entityManager,
    schemaName,
    workspaceId,
    outreachWorkflowId: prefillIds.perCandidate.workflowId,
  });

  const replacements: Record<string, string> = {
    [GTM_WF_AGENT_LINKEDIN]: agentIds.linkedinMessage,
    [GTM_WF_AGENT_EMAIL]: agentIds.fallbackEmail,
    [GTM_WF_AGENT_REPLY]: agentIds.reply,
    [GTM_WF_HARVEST_PROJECT_ID]: harvestProjectId,
    [GTM_WF_FIELD.candidateId]: candidateIdFieldId,
    [GTM_WF_FIELD.profileMemberId]: profileMemberFieldId,
    [GTM_WF_FIELD.chatCandidateId]: chatCandidateFieldId,
  };

  for (const [token, idKey] of Object.entries(LF_TOKEN_TO_ID_KEY)) {
    replacements[token] = lfIds[idKey as keyof typeof lfIds];
  }

  const existingRows = (await entityManager.query(
    `
      SELECT w.name, w.id as "workflowId", wv.id as "workflowVersionId",
             w."coreWorkflowId", wv."coreWorkflowVersionId"
      FROM ${schemaName}.workflow w
      INNER JOIN ${schemaName}."workflowVersion" wv ON wv."workflowId" = w.id
      WHERE w."deletedAt" IS NULL
        AND wv."deletedAt" IS NULL
        AND w.name = ANY($1)
      ORDER BY wv."createdAt" DESC
    `,
    [GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES.map((graph) => graph.name)],
  )) as Array<{
    name: string;
    workflowId: string;
    workflowVersionId: string;
    coreWorkflowId: string;
    coreWorkflowVersionId: string;
  }>;

  const existingByName = new Map<string, Array<(typeof existingRows)[number]>>();

  for (const row of existingRows) {
    const rows = existingByName.get(row.name) ?? [];
    rows.push(row);
    existingByName.set(row.name, rows);
  }

  const workflowRows: Array<Record<string, unknown>> = [];
  const coreWorkflowRows: Array<Record<string, unknown>> = [];
  const versionRows: Array<Record<string, unknown>> = [];
  const coreVersionRows: Array<Record<string, unknown>> = [];

  GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES.forEach((graph, index) => {
    const slug = GRAPH_SLUGS[graph.name];

    if (!slug) {
      throw new Error(`Unknown GTM outreach prefill workflow: ${graph.name}`);
    }

    const existingVersions = existingByName.get(graph.name) ?? [];
    const existing = existingVersions[0];

    if (existing && !replaceExistingDrafts) {
      return;
    }

    const ids = prefillIds[slug];
    const trigger = substituteTokens(graph.trigger, replacements);
    const steps = substituteTokens(graph.steps, replacements);
    const position = index + 3;

    if (existingVersions.length > 0 && replaceExistingDrafts) {
      for (const version of existingVersions) {
        versionRows.push({
          _update: true,
          id: version.workflowVersionId,
          trigger: JSON.stringify(trigger),
          steps: JSON.stringify(steps),
          coreWorkflowVersionId: version.coreWorkflowVersionId,
        });
        coreVersionRows.push({
          _update: true,
          id: version.coreWorkflowVersionId,
          triggers: [trigger],
          steps,
        });
      }

      return;
    }

    const workflowId = existing?.workflowId ?? ids.workflowId;
    const workflowVersionId = existing?.workflowVersionId ?? ids.workflowVersionId;
    const coreWorkflowId = existing?.coreWorkflowId ?? ids.coreWorkflowId;
    const coreWorkflowVersionId =
      existing?.coreWorkflowVersionId ?? ids.coreWorkflowVersionId;

    workflowRows.push({
      id: workflowId,
      name: graph.name,
      lastPublishedVersionId: null,
      statuses: ['DRAFT'],
      position,
      createdBySource: FieldActorSource.SYSTEM,
      createdByWorkspaceMemberId: null,
      createdByName: 'System',
      createdByContext: {},
      updatedBySource: FieldActorSource.SYSTEM,
      updatedByWorkspaceMemberId: null,
      updatedByName: 'System',
      coreWorkflowId,
    });

    coreWorkflowRows.push({
      id: coreWorkflowId,
      workspaceId,
      universalIdentifier: ids.workflowUniversalIdentifier,
      applicationId,
      name: graph.name,
      lastPublishedVersionId: null,
    });

    versionRows.push({
      id: workflowVersionId,
      name: 'v1',
      trigger: JSON.stringify(trigger),
      steps: JSON.stringify(steps),
      status: 'DRAFT',
      position,
      workflowId,
      coreWorkflowVersionId,
    });

    coreVersionRows.push({
      id: coreWorkflowVersionId,
      workspaceId,
      universalIdentifier: ids.workflowVersionUniversalIdentifier,
      applicationId,
      triggers: [trigger],
      steps,
      status: 'DRAFT',
      workflowId,
    });
  });

  for (const row of versionRows.filter((item) => item._update)) {
    await entityManager.query(
      `
        UPDATE ${schemaName}."workflowVersion"
        SET trigger = $2::jsonb, steps = $3::jsonb, "updatedAt" = NOW()
        WHERE id = $1
      `,
      [row.id, row.trigger, row.steps],
    );
  }

  for (const row of coreVersionRows.filter((item) => item._update)) {
    await entityManager.query(
      `
        UPDATE core."workflowVersion"
        SET triggers = $2::jsonb, steps = $3::jsonb
        WHERE id = $1
      `,
      [row.id, JSON.stringify(row.triggers), JSON.stringify(row.steps)],
    );
  }

  const insertVersions = versionRows.filter((item) => !item._update);
  const insertCoreVersions = coreVersionRows.filter((item) => !item._update);

  if (workflowRows.length === 0 && insertVersions.length === 0) {
    return;
  }

  if (workflowRows.length > 0) {
    await entityManager
      .createQueryBuilder()
      .insert()
      .into(`${schemaName}.workflow`, [
        'id',
        'name',
        'lastPublishedVersionId',
        'statuses',
        'position',
        'createdBySource',
        'createdByWorkspaceMemberId',
        'createdByName',
        'createdByContext',
        'updatedBySource',
        'updatedByWorkspaceMemberId',
        'updatedByName',
        'coreWorkflowId',
      ])
      .orIgnore()
      .values(workflowRows)
      .execute();

    await entityManager
      .createQueryBuilder()
      .insert()
      .into('core.workflow', [
        'id',
        'workspaceId',
        'universalIdentifier',
        'applicationId',
        'lastPublishedVersionId',
        'name',
      ])
      .orIgnore()
      .values(coreWorkflowRows)
      .execute();
  }

  if (insertVersions.length > 0) {
    await entityManager
      .createQueryBuilder()
      .insert()
      .into(`${schemaName}.workflowVersion`, [
        'id',
        'name',
        'trigger',
        'steps',
        'status',
        'position',
        'workflowId',
        'coreWorkflowVersionId',
      ])
      .orIgnore()
      .values(insertVersions)
      .execute();

    await entityManager
      .createQueryBuilder()
      .insert()
      .into('core.workflowVersion', [
        'id',
        'workspaceId',
        'universalIdentifier',
        'applicationId',
        'triggers',
        'steps',
        'status',
        'workflowId',
      ])
      .orIgnore()
      .values(insertCoreVersions)
      .execute();
  }
};

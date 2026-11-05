import { type EntityManager } from 'typeorm';

import { retireDuplicateOutreachSequencerWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/outreach-workflow-cleanup.util';

const SCHEMA = 'workspace_test';
const SEEDED_ID = 'seeded-sequencer-id';

const buildEntityManager = ({
  sequencers,
  projectTable = '_project',
}: {
  sequencers: Array<{ id: string; coreWorkflowId: string | null }>;
  projectTable?: string | null;
}) => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('ORDER BY (id = $2) DESC')) {
      return sequencers;
    }

    if (sql.includes('information_schema.columns')) {
      return projectTable === null ? [] : [{ table_name: projectTable }];
    }

    return [];
  });

  return { entityManager: { query } as unknown as EntityManager, query };
};

const findCall = (query: jest.Mock, fragment: string) =>
  query.mock.calls.find(([sql]) => (sql as string).includes(fragment));

describe('retireDuplicateOutreachSequencerWorkflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do nothing when only one sequencer exists', async () => {
    const { entityManager, query } = buildEntityManager({
      sequencers: [{ id: SEEDED_ID, coreWorkflowId: 'core-seeded' }],
    });

    const result = await retireDuplicateOutreachSequencerWorkflows({
      schemaName: SCHEMA,
      entityManager,
      seededSequencerWorkflowId: SEEDED_ID,
    });

    expect(result).toEqual({ keptWorkflowId: SEEDED_ID, workflowIds: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('should keep the first-ranked sequencer and retire the copies when duplicates exist', async () => {
    const { entityManager, query } = buildEntityManager({
      sequencers: [
        { id: SEEDED_ID, coreWorkflowId: 'core-seeded' },
        { id: 'copy-id', coreWorkflowId: 'core-copy' },
      ],
    });

    const result = await retireDuplicateOutreachSequencerWorkflows({
      schemaName: SCHEMA,
      entityManager,
      seededSequencerWorkflowId: SEEDED_ID,
    });

    expect(result).toEqual({
      keptWorkflowId: SEEDED_ID,
      workflowIds: ['copy-id'],
    });

    const lookup = findCall(query, 'ORDER BY (id = $2) DESC');

    expect(lookup?.[1]).toEqual(['Outreach — Candidate Sequencer', SEEDED_ID]);

    const repoint = findCall(query, `${SCHEMA}."_project"`);

    expect(repoint?.[1]).toEqual([['copy-id'], SEEDED_ID]);

    const stopRuns = findCall(query, "SET status = 'STOPPED'");

    expect(stopRuns?.[1]).toEqual([['copy-id']]);

    const deleteTriggers = findCall(
      query,
      'DELETE FROM workspace_test."workflowAutomatedTrigger"',
    );

    expect(deleteTriggers?.[1]).toEqual([['copy-id']]);

    const deleteCoreWorkflow = findCall(query, 'DELETE FROM core.workflow');

    expect(deleteCoreWorkflow?.[1]).toEqual([['core-copy']]);
  });

  it('should skip the project repoint when no project table has outreachWorkflowId', async () => {
    const { entityManager, query } = buildEntityManager({
      sequencers: [
        { id: SEEDED_ID, coreWorkflowId: null },
        { id: 'copy-id', coreWorkflowId: null },
      ],
      projectTable: null,
    });

    await retireDuplicateOutreachSequencerWorkflows({
      schemaName: SCHEMA,
      entityManager,
      seededSequencerWorkflowId: SEEDED_ID,
    });

    expect(findCall(query, '"outreachWorkflowId" = $2')).toBeUndefined();
    expect(findCall(query, 'DELETE FROM core.workflow')).toBeUndefined();
  });
});

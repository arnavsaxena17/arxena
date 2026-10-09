import { OutreachAiColumnRunService } from 'src/engine/core-modules/outreach-command/services/outreach-ai-column-run.service';
import { type OutreachWorkingSetRow } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';

const buildRow = (
  id: string,
  otherFields: Record<string, unknown> = {},
): OutreachWorkingSetRow => ({
  id,
  source: 'crm',
  name: `Person ${id}`,
  title: 'Chief Executive Officer',
  companyName: `Company ${id}`,
  otherFields,
});

const FILTER = {
  name: 'Is CEO',
  prompt: 'CEO?',
  selectedModel: 'jev',
  fields: [{ name: 'isCeo', type: 'boolean' as const }],
  selectedMetadataFields: ['name', 'jobTitle'],
};

const setup = ({
  rows,
  evaluate,
}: {
  rows: OutreachWorkingSetRow[];
  evaluate?: jest.Mock;
}) => {
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.parse(JSON.stringify(value)));
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  const queue = { add: jest.fn(async () => undefined) };
  const column = {
    getPreviewState: jest.fn(async () => ({
      previewId: 'preview-1',
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      filter: FILTER,
      previewedRows: {},
    })),
    evaluateRows:
      evaluate ??
      jest.fn(async (chunkRows: OutreachWorkingSetRow[]) => ({
        results: chunkRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: 'answered',
          values: { isCeo: true },
        })),
        usage: {
          engine: 'openai',
          model: 'gpt-4o-mini',
          calls: chunkRows.length,
          webSearchCalls: 0,
          inputTokens: 10,
          outputTokens: 1,
          estimatedCostUsd: 0.001,
          durationMs: 5,
        },
      })),
  };
  const workingSet = {
    getAll: jest.fn(async () => rows),
    writeOtherFields: jest.fn(async () => ({
      ephemeralUpdated: 0,
      crmUpdated: 1,
    })),
  };
  const realtime = {
    notifyAiColumnProgress: jest.fn(),
    notifyProjectCacheUpdated: jest.fn(),
  };
  const service = new OutreachAiColumnRunService(
    cache as never,
    queue as never,
    column as never,
    workingSet as never,
    realtime as never,
  );

  return { service, queue, workingSet, realtime, column, store };
};

describe('OutreachAiColumnRunService', () => {
  it('should skip rows that already have the column and queue the first chunk', async () => {
    const { service, queue } = setup({
      rows: [buildRow('a', { isCeo: true }), buildRow('b'), buildRow('c')],
    });

    const state = await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });

    expect(state.total).toBe(3);
    expect(state.done).toBe(1);
    expect(state.units.flat()).toEqual(['b', 'c']);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('should write a failed marker, not a value, for rows the model could not answer', async () => {
    const evaluate = jest.fn(async (chunkRows: OutreachWorkingSetRow[]) => ({
      results: chunkRows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.id === 'b' ? 'failed' : 'answered',
        values: row.id === 'b' ? {} : { isCeo: true },
        ...(row.id === 'b' ? { error: 'timeout' } : {}),
      })),
      usage: {
        engine: 'openai',
        model: 'gpt-4o-mini',
        calls: 2,
        webSearchCalls: 0,
        inputTokens: 20,
        outputTokens: 2,
        estimatedCostUsd: 0.002,
        durationMs: 5,
      },
    }));
    const { service, workingSet } = setup({
      rows: [buildRow('a'), buildRow('b')],
      evaluate,
    });
    const started = await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });

    await service.processChunk(started.runId);

    const written = (
      workingSet.writeOtherFields.mock.calls as unknown as Array<
        [{ valuesByRowId: Map<string, Record<string, unknown>> }]
      >
    )[0][0].valuesByRowId;
    const finished = await service.getRun(started.runId);

    expect(written.get('a')).toMatchObject({
      isCeo: true,
      aiColumns: { isCeo: { status: 'ok' } },
    });
    expect(written.get('b')).not.toHaveProperty('isCeo');
    expect(written.get('b')).toMatchObject({
      aiColumns: { isCeo: { status: 'failed', error: 'timeout' } },
    });
    expect(finished).toMatchObject({
      status: 'completed',
      answered: 1,
      failed: 1,
      done: 2,
    });
  });

  it('should stop the run when every row fails because credits are exhausted', async () => {
    const evaluate = jest.fn(async (chunkRows: OutreachWorkingSetRow[]) => ({
      results: chunkRows.map((row) => ({
        id: row.id,
        name: row.name,
        status: 'failed',
        values: {},
        error: 'OpenAI credits are exhausted (credit_balance_exhausted).',
      })),
      usage: {
        engine: 'openai',
        model: 'gpt-4o-mini',
        calls: 0,
        webSearchCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 1,
      },
    }));
    const { service, queue } = setup({
      rows: [buildRow('a'), buildRow('b')],
      evaluate,
    });
    const started = await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });

    await service.processChunk(started.runId);

    const finished = await service.getRun(started.runId);

    expect(finished?.status).toBe('failed');
    expect(finished?.error).toContain('credit_balance_exhausted');
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('should refuse to start a second column while one is running for the project', async () => {
    const { service } = setup({ rows: [buildRow('a')] });

    await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });

    await expect(
      service.startRun({
        workspaceId: 'ws',
        projectId: 'project',
        subject: 'person',
        previewId: 'preview-1',
      }),
    ).rejects.toThrow('already running');
  });

  it('should let a new run replace one that stopped moving (lost job)', async () => {
    const { service, queue, store } = setup({ rows: [buildRow('a')] });
    const first = await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });
    const key = `outreach-ai-column-run:${first.runId}`;
    const saved = store.get(key) as Record<string, unknown>;

    // the worker restarted: nothing has moved for ten minutes
    store.set(key, {
      ...saved,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });

    const second = await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });

    expect(second.runId).not.toBe(first.runId);
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect((await service.getRun(first.runId))?.status).toBe('failed');
    expect((await service.getRun(first.runId))?.error).toContain('Stalled');
  });

  it('should cancel a stalled run straight away', async () => {
    const { service, store } = setup({ rows: [buildRow('a')] });
    const started = await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });
    const key = `outreach-ai-column-run:${started.runId}`;

    store.set(key, {
      ...(store.get(key) as Record<string, unknown>),
      status: 'running',
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });

    expect((await service.cancelRun(started.runId))?.status).toBe('cancelled');
  });

  it('should end the run as failed, not leave it running, when a chunk throws', async () => {
    const { service, workingSet } = setup({ rows: [buildRow('a')] });
    const started = await service.startRun({
      workspaceId: 'ws',
      projectId: 'project',
      subject: 'person',
      previewId: 'preview-1',
    });

    workingSet.writeOtherFields.mockRejectedValueOnce(
      new Error('invalid input syntax for type uuid'),
    );
    await service.processChunk(started.runId);

    const finished = await service.getRun(started.runId);

    expect(finished?.status).toBe('failed');
    expect(finished?.error).toContain('invalid input syntax');
  });
});

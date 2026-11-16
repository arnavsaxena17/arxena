import {
  SourcingRunService,
  type SourcingRoundJobData,
} from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.service';
import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { mergeOutreachOtherFields } from 'src/engine/core-modules/outreach-command/utils/merge-outreach-other-fields.util';
import { type SourcingLedgerEvent } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { type SourcingSpecDraft } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

// An in-memory project: ledger, People tab and queue, with a people index
// that returns `pageSize` new people per page until `poolSize` is reached. A
// person qualifies when their title says "plant head".
const buildHarness = ({
  poolSize,
  pageSize = 100,
  qualifyingShare = 1,
  unclearTitles = false,
}: {
  poolSize: number;
  pageSize?: number;
  qualifyingShare?: number;
  unclearTitles?: boolean;
}) => {
  const ledger: SourcingLedgerEvent[] = [];
  const people: OutreachTabRow[] = [];
  const jobs: SourcingRoundJobData[] = [];
  const toolCalls: Array<{ toolName: string; args: Record<string, unknown> }> =
    [];

  const sourcingLedgerService = {
    read: jest.fn(async () => [...ledger]),
    append: jest.fn(async (_workspaceId, _projectId, event) => {
      ledger.push(event);
    }),
  };
  const outreachTabService = {
    getAll: jest.fn(async () => people.map((row) => ({ ...row }))),
  };
  const judge = {
    judgeRows: jest.fn(
      async ({ rows }: { rows: OutreachTabRow[]; level?: string }) => {
        const counts = { qualified: 0, unknown: 0, to_confirm: 0, fail: 0 };
        const results = new Map();

        for (const row of rows) {
          const outcome =
            row.title === 'Plant Head'
              ? 'qualified'
              : row.title === 'Unclear'
                ? 'unknown'
                : 'fail';
          const target = people.find((person) => person.id === row.id);

          counts[outcome] += 1;
          results.set(row.id, {
            outcome,
            unsettled:
              outcome === 'unknown'
                ? [{ key: 'must_1_title', settledBy: 'profile' }]
                : [],
          });

          if (target !== undefined) {
            target.otherFields =
              mergeOutreachOtherFields(target.otherFields, {
                judgeOutcome: outcome,
                sourcingStage: outcome === 'fail' ? 'rejected' : 'verified',
              }) ?? {};
          }
        }

        return {
          results,
          counts,
          modelRows: rows.length,
          cachedRows: 0,
          triaged: 0,
          costUsd: rows.length * 0.0005,
        };
      },
    ),
  };
  const spec: SourcingSpecDraft = {
    hard: [
      { field: 'title', userWords: 'Plant head', normalized: ['plant head'] },
    ],
    soft: [],
    exclusions: [],
    normalized: { titles: ['plant head'], industries: [] },
    target: { count: null },
  };
  const parser = { parse: jest.fn(async () => spec) };
  const registry = {
    resolveAndExecute: jest.fn(
      async (toolName: string, args: Record<string, unknown>) => {
        toolCalls.push({ toolName, args });
        const offset = Number(args.offset ?? 0);
        const limit = Number(args.limit ?? pageSize);
        const fetched = Math.max(0, Math.min(limit, poolSize - offset));

        for (let index = 0; index < fetched; index++) {
          const number = offset + index;

          people.push({
            id: `person-${number}`,
            source: 'ephemeral',
            name: `Person ${number}`,
            title:
              number % Math.round(1 / qualifyingShare) === 0
                ? 'Plant Head'
                : unclearTitles
                  ? 'Unclear'
                  : 'Sales Manager',
            linkedinUrl: `https://www.linkedin.com/in/person-${number}`,
            otherFields: {},
          });
        }

        return { success: true, message: 'ok', result: { fetched } };
      },
    ),
  };
  const fetchProfiles = {
    fetch: jest.fn(async ({ rowIds }: { rowIds: string[] }) => {
      for (const person of people.filter((row) => rowIds.includes(row.id))) {
        person.title = 'Plant Head';
      }

      return { fetched: { brightData: rowIds.length, harvest: 0 } };
    }),
  };
  const moduleRef = {
    get: jest.fn((token: { name?: string }) =>
      token.name === 'FetchProfilesService' ? fetchProfiles : registry,
    ),
  };
  const messageQueueService = {
    add: jest.fn(async (_name: string, data: SourcingRoundJobData) => {
      jobs.push(data);
    }),
  };
  const service = new SourcingRunService(
    sourcingLedgerService as never,
    outreachTabService as never,
    judge as never,
    parser as never,
    moduleRef as never,
    messageQueueService as never,
  );

  // What the workers do between two chat turns
  const drainJobs = async (maxJobs = 100) => {
    for (let index = 0; index < maxJobs && jobs.length > 0; index++) {
      await service.runRound(jobs.shift() as SourcingRoundJobData);
    }
  };

  return {
    service,
    ledger,
    people,
    jobs,
    toolCalls,
    drainJobs,
    parser,
    fetchProfiles,
    judge,
  };
};

const start = (
  service: SourcingRunService,
  target: number | null,
  budgetUsd = 5,
) =>
  service.start({
    workspaceId: 'w',
    projectId: 'p',
    request: 'Plant heads in Gujarat',
    budgetUsd,
    target,
    sources: ['internal-index'],
    identity: { roleId: 'role-1', userId: 'user-1' },
  });

describe('SourcingRunService', () => {
  it('should plan and ask before spending anything', async () => {
    const { service, toolCalls, jobs, ledger } = buildHarness({ poolSize: 50 });

    const view = await start(service, 10);

    expect(view.phase).toBe('PLANNED');
    expect(view.question?.kind).toBe('confirm');
    expect(view.question?.text).toContain('Must have: Plant head');
    expect(toolCalls).toHaveLength(0);
    expect(jobs).toHaveLength(0);
    expect(ledger.map((event) => event.kind)).toEqual(['brief', 'run']);
    expect(ledger[0]).toEqual(
      expect.objectContaining({
        capsUsd: { run: 5 },
        sources: ['internal-index'],
      }),
    );
  });

  it('should run a 300-person search in a handful of chat steps', async () => {
    const { service, drainJobs, toolCalls } = buildHarness({ poolSize: 2000 });
    let chatSteps = 0;

    const planned = await start(service, 300);

    chatSteps += 1;

    await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
      answer: 'yes',
    });
    chatSteps += 1;

    await drainJobs();

    const final = await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
    });

    chatSteps += 1;

    expect(chatSteps).toBeLessThan(20);
    expect(final?.done).toBe(true);
    expect(final?.phase).toBe('DONE');
    expect(final?.whyStopped).toBe('target_met');
    expect(final?.qualified).toBeGreaterThanOrEqual(300);
    // One probe page then fetch pages, paged by the server
    expect(toolCalls[0].args).toEqual(
      expect.objectContaining({ limit: 25, offset: 0 }),
    );
    expect(toolCalls[1].args).toEqual(
      expect.objectContaining({ limit: 100, offset: 25 }),
    );
  });

  it('should stop as exhausted when the source runs dry', async () => {
    const { service, drainJobs } = buildHarness({ poolSize: 60 });
    const planned = await start(service, null);

    await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
      answer: 'yes',
    });
    await drainJobs();

    const final = await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
    });

    expect(final).toEqual(
      expect.objectContaining({ done: true, phase: 'DONE', qualified: 60 }),
    );
  });

  it('should ask for one FIX knob when a run falls short, and stop on it', async () => {
    const { service, drainJobs } = buildHarness({ poolSize: 40 });
    const planned = await start(service, 100);

    await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
      answer: 'yes',
    });
    await drainJobs();

    const short = await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
    });

    expect(short?.phase).toBe('FIXING');
    expect(short?.question?.options.map((option) => option.value)).toEqual([
      'add_source',
      'broaden_titles',
      'stop',
    ]);

    const stopped = await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
      answer: 'stop',
    });

    expect(stopped).toEqual(
      expect.objectContaining({ done: true, phase: 'SHORT', qualified: 40 }),
    );
    expect(stopped?.report).toContain('40 qualified');
  });

  it('should cancel on no and ignore a stale duplicate job', async () => {
    const { service, jobs, toolCalls } = buildHarness({ poolSize: 50 });
    const planned = await start(service, 10);

    await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
      answer: 'yes',
    });

    const duplicate = { ...jobs[0], version: jobs[0].version - 1 };

    await service.runRound(duplicate);
    expect(toolCalls).toHaveLength(0);

    const cancelled = await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
      answer: 'cancel',
    });

    expect(cancelled?.phase).toBe('CANCELLED');
    await service.runRound(jobs[0]);
    expect(toolCalls).toHaveLength(0);
  });

  it('should enrich only the rows the judge left open, then judge them on the profile', async () => {
    const { service, drainJobs, fetchProfiles, judge } = buildHarness({
      poolSize: 50,
      qualifyingShare: 0.5,
      unclearTitles: true,
    });
    const planned = await start(service, 40);

    await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
      answer: 'yes',
    });
    await drainJobs();

    const final = await service.next({
      workspaceId: 'w',
      projectId: 'p',
      runId: planned.runId,
    });
    const enrichedIds = fetchProfiles.fetch.mock.calls.flatMap(
      ([input]) => input.rowIds,
    );

    expect(enrichedIds).toHaveLength(25);
    expect(
      enrichedIds.every((id: string) => Number(id.split('-')[1]) % 2 === 1),
    ).toBe(true);
    expect(
      judge.judgeRows.mock.calls.some(([input]) => input.level === 'full'),
    ).toBe(true);
    expect(final?.qualified).toBe(50);
  });
});

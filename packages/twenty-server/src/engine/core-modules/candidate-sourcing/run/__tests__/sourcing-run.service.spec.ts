import {
  SourcingRunService,
  type SourcingRoundJobData,
} from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.service';
import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { mergeOutreachOtherFields } from 'src/engine/core-modules/outreach-command/utils/merge-outreach-other-fields.util';
import { type SourcingLedgerEvent } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { type SourcingSpecDraft } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

// An in-memory project: ledger, People tab and queue. The fake source behaves
// like the paid one the loop drives today: a probe samples a few rows, a paid
// fetch takes as many as its budget buys, and it runs out when the pool does.
// A person qualifies when their title says "plant head".
const COST_PER_RECORD_USD = 0.002;
const PROBE_SAMPLE_ROWS = 10;

const buildHarness = ({
  poolSize,
  qualifyingShare = 1,
  unclearTitles = false,
  spec: specOverrides,
}: {
  poolSize: number;
  qualifyingShare?: number;
  unclearTitles?: boolean;
  spec?: Partial<SourcingSpecDraft>;
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
    ...specOverrides,
  };
  const parser = { parse: jest.fn(async () => spec) };

  const addRows = (count: number): number => {
    let added = 0;

    for (let index = 0; index < count; index++) {
      const number = people.length;

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
      added += 1;
    }

    return added;
  };

  const registry = {
    resolveAndExecute: jest.fn(
      async (toolName: string, args: Record<string, unknown>) => {
        toolCalls.push({ toolName, args });

        const isEstimate = args.execute !== true;
        const poolLeft = Math.max(0, poolSize - people.length);
        const targetCount =
          typeof args.targetCount === 'number' ? args.targetCount : Infinity;
        // A paid fetch pages internally until its budget or the target is met;
        // a probe only samples, which is why it can cost almost nothing
        const wanted = isEstimate
          ? PROBE_SAMPLE_ROWS
          : Math.floor(Number(args.maxBudgetUsd ?? 0) / COST_PER_RECORD_USD);
        const fetched = addRows(
          Math.max(0, Math.min(wanted, poolLeft, targetCount)),
        );

        return {
          success: true,
          message: 'ok',
          result: isEstimate
            ? {
                estimateCostUsd: 0.01,
                estimatedUniqueRecords: poolLeft,
                sampleCount: fetched,
              }
            : { spentUsd: fetched * COST_PER_RECORD_USD },
        };
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
    request: 'Plant heads in Gujarat chemical companies',
    budgetUsd,
    target,
    sources: ['bright-data'],
    identity: { roleId: 'role-1', userId: 'user-1' },
  });

const advance = async (
  service: SourcingRunService,
  runId: string,
  answer?: string,
) =>
  service.next({
    workspaceId: 'w',
    projectId: 'p',
    runId,
    ...(answer !== undefined && { answer }),
  });

describe('SourcingRunService', () => {
  it('should plan and ask before spending anything', async () => {
    const { service, toolCalls, jobs, ledger } = buildHarness({ poolSize: 50 });

    const view = await start(service, 10);

    expect(view.phase).toBe('PLANNED');
    expect(view.question?.kind).toBe('confirm');
    expect(view.question?.text).toContain('Must have: Plant head');
    expect(view.candidates.length).toBeGreaterThan(0);
    expect(view.candidates.every((item) => item.source === 'bright-data')).toBe(
      true,
    );
    expect(toolCalls).toHaveLength(0);
    expect(jobs).toHaveLength(0);
    expect(ledger.map((event) => event.kind)).toEqual(['brief', 'run']);
    expect(ledger[0]).toEqual(
      expect.objectContaining({
        capsUsd: { run: 5 },
        sources: ['bright-data'],
      }),
    );
  });

  it('should plan several query variants per paid source', async () => {
    const { service } = buildHarness({ poolSize: 50 });

    const view = await start(service, 10);
    const queries = view.candidates.map((candidate) => candidate.query);

    expect(queries.length).toBeGreaterThan(1);
    expect(new Set(queries).size).toBe(queries.length);
    expect(queries[0]).toBe('Plant heads in Gujarat chemical companies');
  });

  it('should plan one variant when the budget only covers one probe', async () => {
    const { service } = buildHarness({ poolSize: 50 });

    const view = await start(service, 10, 0.4);

    expect(view.candidates).toHaveLength(1);
  });

  it('should run a 300-person search in a handful of chat steps', async () => {
    const { service, drainJobs, toolCalls } = buildHarness({
      poolSize: 2000,
    });
    let chatSteps = 0;

    const planned = await start(service, 300);

    chatSteps += 1;

    await advance(service, planned.runId, 'yes');
    chatSteps += 1;

    await drainJobs();

    const final = await advance(service, planned.runId);

    chatSteps += 1;

    expect(chatSteps).toBeLessThan(20);
    expect(final?.done).toBe(true);
    expect(final?.phase).toBe('DONE');
    expect(final?.whyStopped).toBe('target_met');
    expect(final?.qualified).toBeGreaterThanOrEqual(300);
    // Probes are free-ish estimates, fetches are the paid ones
    expect(toolCalls[0]).toEqual(
      expect.objectContaining({
        toolName: 'search_bright_data_business',
        args: expect.objectContaining({ entity: 'people', projectId: 'p' }),
      }),
    );
    expect(toolCalls[0].args.execute).toBeUndefined();
    expect(
      toolCalls.some(
        (call) =>
          call.toolName === 'search_bright_data_business' &&
          call.args.execute === true,
      ),
    ).toBe(true);
  });

  it('should stop as exhausted when the source runs dry', async () => {
    const { service, drainJobs } = buildHarness({ poolSize: 60 });
    const planned = await start(service, null);

    await advance(service, planned.runId, 'yes');
    await drainJobs();

    const final = await advance(service, planned.runId);

    expect(final).toEqual(
      expect.objectContaining({ done: true, qualified: 60 }),
    );
  });

  it('should offer only FIX knobs that can still act', async () => {
    const { service, drainJobs, toolCalls } = buildHarness({
      poolSize: 40,
      // One variant planned, so broadening still has a query left to ask
      spec: {
        hard: [
          { field: 'title', userWords: 'Plant head', normalized: ['plant head'] },
          { field: 'location', userWords: 'Gujarat', normalized: ['gujarat'] },
        ],
      },
    });
    const planned = await start(service, 100, 0.4);

    await advance(service, planned.runId, 'yes');
    await drainJobs();

    const short = await advance(service, planned.runId);

    expect(short?.phase).toBe('FIXING');
    expect(short?.question?.options.map((option) => option.value)).toEqual([
      'broaden_titles',
      'stop',
    ]);

    const before = toolCalls.length;

    const broadened = await advance(service, planned.runId, 'broaden_titles');

    expect(broadened?.question).toBeUndefined();
    expect(broadened?.candidates.length).toBeGreaterThan(
      short?.candidates.length ?? 0,
    );

    await drainJobs();

    const stopped = await advance(service, planned.runId, 'stop');

    expect(stopped?.done).toBe(true);
    expect(toolCalls.length).toBeGreaterThan(before);
  });

  it('should cancel on no and ignore a stale duplicate job', async () => {
    const { service, jobs, toolCalls } = buildHarness({ poolSize: 50 });
    const planned = await start(service, 10);

    await advance(service, planned.runId, 'yes');

    const duplicate = { ...jobs[0], version: jobs[0].version - 1 };

    await service.runRound(duplicate);
    expect(toolCalls).toHaveLength(0);

    const cancelled = await advance(service, planned.runId, 'cancel');

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

    await advance(service, planned.runId, 'yes');
    await drainJobs();

    const final = await advance(service, planned.runId);
    const enrichedIds = fetchProfiles.fetch.mock.calls.flatMap(
      ([input]) => input.rowIds,
    );

    expect(enrichedIds.length).toBeGreaterThan(0);
    expect(
      enrichedIds.every((id: string) => Number(id.split('-')[1]) % 2 === 1),
    ).toBe(true);
    expect(
      judge.judgeRows.mock.calls.some(([input]) => input.level === 'full'),
    ).toBe(true);
    expect(final?.done).toBe(true);
    // The rest of the pool comes in on the next page, then enrich settles it
    expect(final?.qualified).toBe(50);
  });
});

import { type JudgeOutcome } from 'src/domains/ingestion/candidate-sourcing/run/judge.util';
import {
  SourcingRunService,
  type SourcingRunLedger,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.service';
import {
  type EnrichmentStep,
  type JudgedRow,
  type PlannedQuery,
  type RunCandidate,
  type SourcingRunPorts,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import {
  type SourceErrorCode,
  type SourceSearchResult,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  type SourcingBrief,
  type SourcingLedgerEvent,
} from 'src/domains/engagement/outreach-command/utils/sourcing-ledger.util';

const WORKSPACE = 'workspace-1';
const PROJECT = 'project-1';

const QUERY: PlannedQuery = {
  label: 'CFO in Mumbai',
  keywords: 'cfo',
  jobTitle: 'CFO',
  companies: [],
  locations: ['Mumbai'],
};

const brief = (overrides: Partial<SourcingBrief> = {}): SourcingBrief => ({
  requestType: 'population',
  target: 40,
  who: 'CFOs in Mumbai',
  criteria: [],
  assumptions: [],
  sources: ['index'],
  ...overrides,
});

// What a fake source serves for one page; the harness plays the project tab
type FakeRow = { id: string };

type FakePage = {
  rows?: FakeRow[];
  costUsd: number;
  counts?: number;
  nextCursor?: string;
  error?: SourceErrorCode;
};

const row = (id: string): FakeRow => ({ id });

const rows = (prefix: string, count: number): FakeRow[] =>
  Array.from({ length: count }, (_unused, index) => row(`${prefix}-${index}`));

type Harness = {
  service: SourcingRunService;
  events: SourcingLedgerEvent[];
  ports: jest.Mocked<Required<SourcingRunPorts>>;
  ledger: SourcingRunLedger;
};

// A project tab in memory: rows are stored once, judged by the rule given,
// and enriched rows are judged again
const createHarness = ({
  search,
  outcomeOf = () => 'qualified',
  queries = [QUERY],
  costPerSearchUsd = 0,
}: {
  search: (
    candidate: RunCandidate,
    request: { page: number; cursor: string | undefined },
  ) => FakePage;
  outcomeOf?: (rowId: string, isEnriched: boolean) => JudgeOutcome;
  queries?: PlannedQuery[];
  costPerSearchUsd?: number;
}): Harness => {
  const events: SourcingLedgerEvent[] = [];
  const stored = new Map<string, JudgeOutcome | undefined>();
  const enriched = new Set<string>();
  const pending = new Set<string>();
  const ledger: SourcingRunLedger = {
    read: async () => events,
    append: async (_workspaceId, _projectId, event) => {
      events.push(event);
    },
  };
  const ports = {
    compile: jest.fn(async () => queries),
    // A source adapter searches and writes the page to the tab in one step
    search: jest.fn(
      async (
        candidate: RunCandidate,
        request: { page: number; cursor: string | undefined },
      ): Promise<SourceSearchResult> => {
        const page = search(candidate, request);
        let newUnique = 0;

        for (const { id } of page.rows ?? []) {
          if (!stored.has(id)) {
            stored.set(id, undefined);
            pending.add(id);
            newUnique += 1;
          }
        }

        return {
          fetched: page.rows?.length ?? 0,
          newUnique,
          costUsd: page.costUsd + costPerSearchUsd,
          ...(page.counts !== undefined && { counts: page.counts }),
          ...(page.nextCursor !== undefined && { nextCursor: page.nextCursor }),
          ...(page.error !== undefined && { error: page.error }),
        };
      },
    ),
    judge: jest.fn(async () => {
      const judged: JudgedRow[] = [...pending].map((rowId) => {
        const outcome = outcomeOf(rowId, enriched.has(rowId));

        stored.set(rowId, outcome);

        return {
          rowId,
          outcome,
          enrich: outcome === 'unknown' ? ['profile'] : [],
        };
      });

      pending.clear();

      return { rows: judged, costUsd: 0 };
    }),
    tally: jest.fn(async () => {
      const tally = { qualified: 0, unknown: 0, to_confirm: 0, fail: 0 };

      for (const outcome of stored.values()) {
        if (outcome !== undefined) {
          tally[outcome] += 1;
        }
      }

      return tally;
    }),
    enrich: jest.fn(async (_state: unknown, step: EnrichmentStep) => {
      for (const rowId of step.rowIds) {
        enriched.add(rowId);
        pending.add(rowId);
      }

      return { costUsd: step.costUsd };
    }),
    split: jest.fn(async () => []),
    fix: jest.fn(async () => null),
  } as unknown as jest.Mocked<Required<SourcingRunPorts>>;

  return {
    service: new SourcingRunService(ledger, ports),
    events,
    ports,
    ledger,
  };
};

const pagesOf =
  (pages: FakeRow[][], extras: { counts?: number; costUsd?: number } = {}) =>
  (_candidate: RunCandidate, request: { page: number }): FakePage => ({
    rows: pages[request.page - 1] ?? [],
    costUsd: extras.costUsd ?? 0,
    ...(extras.counts !== undefined && { counts: extras.counts }),
    ...(request.page < pages.length && { nextCursor: `page-${request.page}` }),
  });

const roundsOf = (events: SourcingLedgerEvent[]): string[] =>
  events.flatMap((event) => (event.kind === 'round' ? [event.round] : []));

const runToEnd = async (harness: Harness, runId: string, maxRounds = 10) => {
  let view = await harness.service.next({
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    runId,
  });

  for (let round = 1; round < maxRounds && !view.done; round += 1) {
    view = await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });
  }

  return view;
};

const start = (harness: Harness, overrides: Partial<SourcingBrief> = {}) =>
  harness.service.start({
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    brief: brief(overrides),
    budgetUsd: 1,
  });

describe('SourcingRunService', () => {
  it('should plan without spending, and name the sources it cannot run', async () => {
    const harness = createHarness({ search: pagesOf([]) });

    const view = await start(harness, {
      sources: ['index', 'apollo', 'made-up'],
    });

    expect(harness.ports.search).not.toHaveBeenCalled();
    expect(view).toMatchObject({
      done: false,
      phase: 'PLANNED',
      spentUsd: 0,
      candidates: [{ source: 'index', label: 'CFO in Mumbai', fetched: 0 }],
      unusable: [
        { source: 'apollo', reason: 'no price is recorded for it' },
        { source: 'made-up', reason: 'not a source the loop knows' },
      ],
    });
    expect(roundsOf(harness.events)).toEqual(['plan']);
  });

  it('should be blocked when no picked source can run', async () => {
    const harness = createHarness({ search: pagesOf([]) });

    const view = await start(harness, { sources: [] });

    expect(view).toMatchObject({ done: true, phase: 'BLOCKED' });
  });

  it('should probe, then fetch what it selected, and stop at the target', async () => {
    const harness = createHarness({
      search: pagesOf([rows('a', 25), rows('b', 25), rows('c', 25)]),
    });
    const { runId } = await start(harness);

    const first = await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });

    expect(first).toMatchObject({ done: false, qualified: 25, rounds: 1 });
    expect(harness.ports.search).toHaveBeenCalledTimes(1);

    const second = await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });

    expect(second).toMatchObject({
      done: true,
      phase: 'DONE',
      qualified: 50,
      whyStopped: 'target_met',
    });
    // The third page is never bought: the target was met after two
    expect(harness.ports.search).toHaveBeenCalledTimes(2);
    expect(harness.ports.search.mock.calls[1][1]).toEqual({
      page: 2,
      cursor: 'page-1',
    });
    expect(roundsOf(harness.events)).toEqual([
      'plan',
      'probe',
      'judge',
      'select',
      'fetch',
      'judge',
      'stop',
    ]);
    expect(harness.events.some((event) => event.kind === 'stop')).toBe(true);
  });

  it('should resume from the ledger alone', async () => {
    const harness = createHarness({
      search: pagesOf([rows('a', 25), rows('b', 25)]),
    });
    const { runId } = await start(harness);

    await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });

    const resumed = new SourcingRunService(harness.ledger, harness.ports);
    const view = await resumed.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });

    expect(view).toMatchObject({ done: true, qualified: 50 });
  });

  it('should never spend past the budget, and report the run short', async () => {
    // Harvest bills per row: a page of 25 is $0.10
    const harness = createHarness({
      search: pagesOf(
        [rows('a', 25), rows('b', 25), rows('c', 25), rows('d', 25)],
        { costUsd: 0.1 },
      ),
      // A few per page qualify, so the run is not flat: only money stops it
      outcomeOf: (rowId) => (/-[0-2]$/.test(rowId) ? 'qualified' : 'fail'),
    });
    const { runId } = await harness.service.start({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      brief: brief({ sources: ['harvest'] }),
      budgetUsd: 0.25,
    });

    const view = await runToEnd(harness, runId);

    expect(view).toMatchObject({
      done: true,
      phase: 'SHORT',
      spentUsd: 0.2,
      whyStopped: 'budget',
    });
    expect(harness.ports.search).toHaveBeenCalledTimes(2);
  });

  it('should stop as exhausted when no candidate has more to give', async () => {
    const harness = createHarness({ search: pagesOf([rows('a', 10)]) });
    const { runId } = await start(harness);

    const view = await runToEnd(harness, runId);

    expect(view).toMatchObject({
      done: true,
      phase: 'SHORT',
      qualified: 10,
      whyStopped: 'exhausted',
      candidates: [{ live: false }],
    });
  });

  it('should enrich only the rows that came back unknown, then judge them again', async () => {
    const harness = createHarness({
      search: pagesOf([[row('sure'), row('maybe'), row('no')]]),
      outcomeOf: (rowId, isEnriched) =>
        rowId === 'sure'
          ? 'qualified'
          : rowId === 'no'
            ? 'fail'
            : isEnriched
              ? 'qualified'
              : 'unknown',
    });
    const { runId } = await start(harness);

    const view = await runToEnd(harness, runId);

    expect(harness.ports.enrich).toHaveBeenCalledTimes(1);
    expect(harness.ports.enrich.mock.calls[0][1]).toEqual({
      level: 'profile',
      rowIds: ['maybe'],
      costUsd: 0.02,
    });
    expect(view).toMatchObject({
      qualified: 2,
      failed: 1,
      unknown: 0,
      spentUsd: 0.02,
    });
    expect(roundsOf(harness.events)).toEqual(
      expect.arrayContaining(['judge', 'enrich', 'judge']),
    );
  });

  it('should drop a candidate whose source has no results', async () => {
    const harness = createHarness({
      search: () => ({ costUsd: 0, error: 'no_results' }),
    });
    const { runId } = await start(harness);

    const view = await runToEnd(harness, runId);

    expect(view).toMatchObject({
      phase: 'SHORT',
      whyStopped: 'exhausted',
      candidates: [{ live: false, fetched: 0 }],
    });
  });

  it('should retry a source that may be retried, and give up after three tries', async () => {
    const harness = createHarness({
      search: () => ({ costUsd: 0, error: 'upstream' }),
    });
    const { runId } = await start(harness);

    await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });

    expect(harness.ports.search).toHaveBeenCalledTimes(3);
  });

  it('should apply at most two fixes, one candidate each', async () => {
    const harness = createHarness({ search: pagesOf([rows('a', 3)]) });

    harness.ports.fix.mockImplementation(async (state) => ({
      source: 'index',
      query: { ...QUERY, label: `wider ${state.fixes + 1}` },
      knob: 'widen_title',
    }));

    const { runId } = await start(harness);
    const view = await runToEnd(harness, runId, 12);

    expect(harness.ports.fix).toHaveBeenCalledTimes(2);
    expect(view.candidates.map((candidate) => candidate.label)).toEqual([
      'CFO in Mumbai',
      'wider 1',
      'wider 2',
    ]);
    expect(view).toMatchObject({ done: true, phase: 'SHORT' });
    expect(
      roundsOf(harness.events).filter((round) => round === 'fix'),
    ).toHaveLength(2);
  });

  it('should split a candidate larger than one LinkedIn search can return', async () => {
    const harness = createHarness({
      search: (candidate) => ({
        rows: rows(`${candidate.id}-${candidate.searchType ?? 'untyped'}`, 5),
        costUsd: 0,
        counts: candidate.id.includes('.') ? 1200 : 6000,
        nextCursor: 'more',
      }),
    });

    harness.ports.split.mockResolvedValue([
      { kind: 'boolean', query: 'cfo', facets: { region: 'north' } },
      { kind: 'boolean', query: 'cfo', facets: { region: 'south' } },
    ]);
    harness.ports.compile.mockResolvedValue([QUERY]);

    const started = await harness.service.start({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      brief: brief({ sources: ['linkedin_pool'], target: 500 }),
      budgetUsd: 1,
    });

    // A LinkedIn count is only trusted on Sales Navigator or Recruiter, so a
    // candidate with no search type is never split on it
    const untyped = await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId: started.runId,
    });

    expect(harness.ports.split).not.toHaveBeenCalled();
    expect(untyped.candidates).toHaveLength(1);

    const typed = await harness.service.start({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      brief: brief({ sources: ['linkedin_pool'], target: 500 }),
      budgetUsd: 1,
      searchType: 'sales_navigator',
    });
    const view = await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId: typed.runId,
    });

    expect(harness.ports.split).toHaveBeenCalledTimes(1);
    expect(
      view.candidates.map(({ id, live, available }) => ({
        id,
        live,
        available,
      })),
    ).toEqual([
      { id: 'c1', live: false, available: 6000 },
      { id: 'c1.1', live: true, available: 1200 },
      { id: 'c1.2', live: true, available: 1200 },
    ]);
  });

  it('should cancel a run and refuse to continue it', async () => {
    const harness = createHarness({ search: pagesOf([rows('a', 25)]) });
    const { runId } = await start(harness);

    const cancelled = await harness.service.cancel({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });
    const after = await harness.service.next({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      runId,
    });

    expect(cancelled).toMatchObject({ done: true, phase: 'CANCELLED' });
    expect(after.phase).toBe('CANCELLED');
    expect(harness.ports.search).not.toHaveBeenCalled();
  });

  it('should fail clearly for a run the project does not have', async () => {
    const harness = createHarness({ search: pagesOf([]) });

    await expect(
      harness.service.next({
        workspaceId: WORKSPACE,
        projectId: PROJECT,
        runId: 'missing',
      }),
    ).rejects.toThrow('No sourcing run missing');
  });
});

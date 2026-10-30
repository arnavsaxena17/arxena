import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { type SourcingLedgerEvent } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { GetSourcingLedgerTool } from 'src/engine/core-modules/tool/tools/sourcing-ledger-tool/get-sourcing-ledger-tool';

const profile = {
  source: 'bright_data',
  fetchedAt: 'x',
  fieldsPresent: ['about'],
};

const row = (
  id: string,
  otherFields: Record<string, unknown>,
): OutreachTabRow => ({
  id,
  source: 'ephemeral',
  name: id,
  linkedinUrl: `https://linkedin.com/in/${id}`,
  otherFields,
});

const build = (
  budget = {
    configure: jest.fn(async () => undefined),
    getStatus: jest.fn(async () => ({ spentUsd: 0, exhausted: false })),
  },
) => {
  const events: SourcingLedgerEvent[] = [
    {
      kind: 'search',
      at: 't',
      source: 'bright_data',
      entity: 'people',
      query: 'plant heads',
      fetched: 150,
      duplicates: 30,
      newUnique: 120,
      alreadyKnown: 0,
      spentUsd: 0.3,
    },
    {
      kind: 'profile_fetch',
      at: 't',
      requested: 4,
      brightData: 3,
      harvest: 1,
      notFound: 0,
      remaining: 0,
    },
  ];
  const append = jest.fn(
    async (
      _workspaceId: string,
      _projectId: string,
      event: SourcingLedgerEvent,
    ) => {
      events.push(event);
    },
  );
  const rows = [
    row('a', { fitmentOutcome: 'pass', profile }),
    row('b', { fitmentOutcome: 'pass', profile }),
    row('c', { fitmentOutcome: 'fail', profile }),
    row('d', { fitmentOutcome: 'pass' }),
    row('e', { fitmentOutcome: 'unknown' }),
  ];
  const tool = new GetSourcingLedgerTool(
    { append, read: jest.fn(async () => events) } as never,
    { getAll: jest.fn(async () => rows) } as never,
    budget as never,
  );

  return { tool, append, budget };
};

const context = { workspaceId: 'w' } as never;

describe('GetSourcingLedgerTool', () => {
  it('should show the funnel, the project searches and the shortfall', async () => {
    const { tool } = build();
    const output = await tool.execute({ projectId: 'p1', target: 10 }, context);
    const result = output.result as {
      funnel: { qualified: number; awaitingProfile: number };
      shortfall: { short: number; expectedFromAwaitingProfile: number };
      searches: Array<{ query: string; duplicateShare: number }>;
      searchSpendUsd: number;
    };

    expect(output.success).toBe(true);
    expect(result.funnel.qualified).toBe(2);
    expect(result.shortfall.short).toBe(8);
    // 2 of the 3 people with a profile qualified; 2 people still await one
    expect(result.shortfall.expectedFromAwaitingProfile).toBe(1);
    expect(result.searches.map((search) => search.query)).toEqual(['plant heads']);
    expect(result.searches[0].duplicateShare).toBe(0.2);
    expect(result.searchSpendUsd).toBe(0.3);
  });

  it('should write a stop event when it is told why the run stopped', async () => {
    const { tool, append } = build();

    await tool.execute(
      { projectId: 'p1', target: 10, stoppedBecause: 'Two flat rounds' },
      context,
    );

    expect(append).toHaveBeenCalledWith('w', 'p1', {
      kind: 'stop',
      at: expect.any(String),
      target: 10,
      qualified: 2,
      because: 'Two flat rounds',
    });
  });

  it('should not write anything when only reading', async () => {
    const { tool, append } = build();

    await tool.execute({ projectId: 'p1' }, context);

    expect(append).not.toHaveBeenCalled();
  });

  it('should store the brief and return it with the table', async () => {
    const { tool, append } = build();
    const brief = {
      requestType: 'scored_list' as const,
      target: 60,
      who: 'multi-store Indian consumer brands',
      criteria: [{ description: '20 or more stores', mustHave: true }],
      capsUsd: { fetch: 10, enrich: 12 },
      assumptions: ['Companies headquartered in India'],
    };
    const output = await tool.execute({ projectId: 'p1', brief }, context);

    expect(append).toHaveBeenCalledWith('w', 'p1', {
      kind: 'brief',
      at: expect.any(String),
      ...brief,
      version: 1,
    });
    expect((output.result as { brief: { target: number } }).brief.target).toBe(
      60,
    );
  });

  it('should persist an exhaustive plan, its run cap and the frontier', async () => {
    const budget = {
      configure: jest.fn(async () => undefined),
      getStatus: jest.fn(async () => ({
        runCapUsd: 10,
        spentUsd: 1,
        remainingUsd: 9,
        exhausted: false,
      })),
    };
    const { tool } = build(budget);
    const output = await tool.execute(
      {
        projectId: 'p1',
        brief: {
          coverage: 'exhaustive',
          universe: { kind: 'project', count: 120 },
          capsUsd: { run: 10 },
          queries: [
            { source: 'bright-data', query: 'plant heads' },
            { source: 'serp', query: 'plant head Surat' },
          ],
        },
      },
      context,
    );
    const result = output.result as {
      brief: { coverage: string; budgetRunId: string };
      coverage: {
        mode: string;
        frontier: {
          attempted: number;
          unattempted: number;
          unattemptedQueries: unknown[];
        };
      };
      budget: { runCapUsd: number; spentUsd: number; remainingUsd: number };
    };

    expect(result.brief.coverage).toBe('exhaustive');
    expect(result.brief.budgetRunId).toEqual(expect.any(String));
    expect(result.coverage.mode).toBe('exhaustive');
    expect(result.coverage.frontier.attempted).toBe(1);
    expect(result.coverage.frontier.unattempted).toBe(1);
    expect(result.coverage.frontier.unattemptedQueries).toEqual([
      { source: 'serp', query: 'plant head Surat' },
    ]);
    expect(result.budget).toMatchObject({
      runCapUsd: 10,
      spentUsd: 1,
      remainingUsd: 9,
    });
    expect(budget.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'w',
        projectId: 'p1',
        runCapUsd: 10,
        budgetRunId: expect.any(String),
      }),
    );
  });

  it('should keep the budget window when the cap is raised, and reset only on newRun', async () => {
    const budget = {
      configure: jest.fn(async () => undefined),
      getStatus: jest.fn(async () => ({ spentUsd: 0, exhausted: false })),
    };
    const { tool } = build(budget);
    const readBudgetRunId = async (payload: Record<string, unknown>) => {
      const output = await tool.execute(
        {
          projectId: 'p1',
          brief: { coverage: 'exhaustive', ...payload },
        },
        context,
      );

      return (output.result as { brief: { budgetRunId: string } }).brief
        .budgetRunId;
    };

    const first = await readBudgetRunId({ capsUsd: { run: 10 } });
    const raised = await readBudgetRunId({ capsUsd: { run: 20 } });
    const newRun = await tool.execute(
      {
        projectId: 'p1',
        newRun: true,
        brief: { capsUsd: { run: 20 } },
      },
      context,
    );
    const reset = (newRun.result as { brief: { budgetRunId: string } }).brief
      .budgetRunId;

    expect(raised).toBe(first);
    expect(reset).not.toBe(first);
  });

  it('should refuse a brief with a non-existing request type', async () => {
    const { tool } = build();
    const output = await tool.execute(
      {
        projectId: 'p1',
        brief: {
          requestType: 'everything',
          target: 1,
          who: 'x',
          criteria: [],
          assumptions: [],
        },
      },
      context,
    );

    expect(output.success).toBe(false);
  });
});

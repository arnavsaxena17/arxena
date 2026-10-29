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

const build = () => {
  const events: SourcingLedgerEvent[] = [
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
  const lists = [
    {
      id: 'l1',
      sources: ['bright_data'],
      entity: 'people',
      query: 'plant heads',
      name: 'x',
      rowCount: 120,
      fetched: 150,
      duplicates: 30,
      spentUsd: 0.3,
      projectIds: ['p1'],
    },
    { id: 'l2', sources: ['linkedin'], projectIds: ['other'], spentUsd: 5 },
  ];
  const tool = new GetSourcingLedgerTool(
    { append, read: jest.fn(async () => events) } as never,
    { getAll: jest.fn(async () => rows) } as never,
    { list: jest.fn(async () => lists) } as never,
  );

  return { tool, append };
};

const context = { workspaceId: 'w' } as never;

describe('GetSourcingLedgerTool', () => {
  it('should show the funnel, the project searches and the shortfall', async () => {
    const { tool } = build();
    const output = await tool.execute({ projectId: 'p1', target: 10 }, context);
    const result = output.result as {
      funnel: { qualified: number; awaitingProfile: number };
      shortfall: { short: number; expectedFromAwaitingProfile: number };
      searches: Array<{ listId: string; duplicateShare: number }>;
      searchSpendUsd: number;
    };

    expect(output.success).toBe(true);
    expect(result.funnel.qualified).toBe(2);
    expect(result.shortfall.short).toBe(8);
    // 2 of the 3 people with a profile qualified; 2 people still await one
    expect(result.shortfall.expectedFromAwaitingProfile).toBe(1);
    expect(result.searches.map((search) => search.listId)).toEqual(['l1']);
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

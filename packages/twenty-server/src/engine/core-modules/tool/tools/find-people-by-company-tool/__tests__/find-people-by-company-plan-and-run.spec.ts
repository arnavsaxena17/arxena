import { type SourcingLedgerEvent } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { FindPeopleByCompanyTool } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company-tool';
import { type CompanyOutcome } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';
import { FindPeopleRunService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-run.service';

// the start stagger is a real delay, so it would stall these multi-company
// runs on fake timers
process.env.FIND_ROLE_COMPANY_STAGGER_MS = '0';

const context = { workspaceId: 'w', userId: 'u' };

const foundOutcome = (company: string): CompanyOutcome => ({
  company,
  status: 'matched',
  people: [
    {
      name: `Head of ${company}`,
      title: 'Head of E-commerce',
      companyOnProfile: company,
      linkedinUrl: `https://www.linkedin.com/in/${company.toLowerCase()}`,
      sources: ['bright_data'],
      roleMatch: 'exact',
      roleMatches: [{ role: 'Head of E-commerce', score: 2 }],
      deprioritisedReasons: [],
      rungUsed: 1,
      confidence: 'medium',
      freshness: 'unknown',
      evidence: [],
    },
  ],
  rejected: [],
  sourceErrors: [],
  spentUsd: 0.01,
  terminalState: 'found',
  rungUsed: 1,
  sourcesUsed: ['bright_data'],
  sourcesAttempted: ['bright_data'],
  titlesTried: ['Head of E-commerce'],
  roleStates: [
    {
      role: 'Head of E-commerce',
      terminalState: 'found',
      rungUsed: 1,
      personKeys: [`https://www.linkedin.com/in/${company.toLowerCase()}`],
      sourcesUsed: ['bright_data'],
      peopleCount: 1,
    },
  ],
});

const buildCache = () => {
  const store = new Map<string, unknown>();

  return {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
};

const build = ({
  briefSources = ['bright-data', 'serp'],
  rowCount = 3,
  briefExtra = {},
}: {
  briefSources?: string[] | null;
  rowCount?: number;
  briefExtra?: Record<string, unknown>;
} = {}) => {
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    id: `row-${index}`,
    name: `Company${index}`,
    domain: `company${index}.com`,
    employees: index === 0 ? '11-50' : '1,001-5,000',
    otherFields: index === 1 ? { status: 'unresolvable' } : {},
  }));
  const lookupPair = jest.fn(
    async (company: { name: string }, _input?: { sources?: string[] }) =>
      foundOutcome(company.name),
  );
  const events: SourcingLedgerEvent[] = briefSources
    ? [
        {
          kind: 'brief',
          at: 't',
          requestType: 'named_role',
          target: null,
          who: 'heads of e-commerce',
          criteria: [],
          assumptions: [],
          sources: briefSources,
          ...briefExtra,
        },
      ]
    : [];
  const ledger = {
    read: jest.fn(async () => events),
    append: jest.fn(
      async (_w: string, _p: string, event: SourcingLedgerEvent) => {
        events.push(event);
      },
    ),
  };
  const queue = { add: jest.fn(async () => undefined) };
  const runService = new FindPeopleRunService(
    buildCache() as never,
    queue as never,
  );
  const writeOtherFields = jest
    .fn()
    .mockResolvedValue({ ephemeralUpdated: 1, crmUpdated: 0 });
  const budget = {
    configure: jest.fn(async () => undefined),
    getStatus: jest.fn() as jest.Mock,
    recordSpend: jest.fn(async () => undefined),
  };
  budget.getStatus.mockResolvedValue({ spentUsd: 0, exhausted: false });
  const tool = new FindPeopleByCompanyTool(
    { lookupPair } as never,
    { execute: jest.fn().mockResolvedValue({ success: true }) } as never,
    {
      resolveRoles: jest.fn().mockResolvedValue({ searchTitles: [] }),
    } as never,
    {
      getAll: jest.fn().mockResolvedValue(rows),
      getRowsByIds: jest.fn().mockResolvedValue([]),
      writeOtherFields,
    } as never,
    { get: jest.fn().mockResolvedValue(null) } as never,
    ledger as never,
    runService,
    undefined,
    budget as never,
  );

  return {
    tool,
    lookupPair,
    ledger,
    queue,
    runService,
    writeOtherFields,
    budget,
  };
};

describe('FindPeopleByCompanyTool plan', () => {
  it('should wait for the user to pick sources before a project lookup', async () => {
    const { tool, lookupPair } = build({ briefSources: null });

    const output = await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );

    expect(output.success).toBe(false);
    expect(output.error).toMatch(/not picked the data sources/);
    expect(lookupPair).not.toHaveBeenCalled();
  });

  it('should drop the sources the user did not pick', async () => {
    const { tool, lookupPair } = build({ briefSources: ['bright-data'] });

    await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );

    expect(lookupPair.mock.calls[0]?.[1]?.sources).toEqual(['bright_data']);
  });

  it('should refuse when the user picked no people source it can use', async () => {
    const { tool, lookupPair } = build({ briefSources: ['internal-index'] });

    const output = await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );

    expect(output.success).toBe(false);
    expect(lookupPair).not.toHaveBeenCalled();
  });

  it('should mark an unresolvable company without looking it up', async () => {
    const { tool, lookupPair, writeOtherFields } = build();

    const output = await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );
    const result = output.result as {
      summary: { unresolvable: number; found: number };
    };

    expect(lookupPair).toHaveBeenCalledTimes(2);
    expect(result.summary).toMatchObject({ unresolvable: 1, found: 2 });

    const written = writeOtherFields.mock.calls
      .find(([args]) => args.valuesByRowId.has('row-1'))?.[0]
      .valuesByRowId.get('row-1');

    expect(written.peopleFound).toBe('Unresolvable');
    expect(written.findPeoplePairs['head of e-commerce'].terminalState).toBe(
      'unresolvable',
    );
  });

  it('should pass the employee band and domain on from the row', async () => {
    const { tool, lookupPair } = build();

    await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );

    expect(lookupPair.mock.calls[0][0]).toMatchObject({
      domain: 'company0.com',
      employees: 50,
    });
  });
});

describe('FindPeopleByCompanyTool pilot and run', () => {
  it('should look up only the pilot and record a checkpoint', async () => {
    const { tool, lookupPair, ledger } = build({ rowCount: 12 });

    const output = await tool.execute(
      {
        fromProject: true,
        projectId: 'p',
        roles: ['Head of E-commerce'],
        pilotSize: 10,
      },
      context,
    );

    expect(lookupPair.mock.calls.length).toBeLessThanOrEqual(10);
    expect(
      (output.result as { pilot: { remaining: number } }).pilot.remaining,
    ).toBe(2);
    expect(ledger.append).toHaveBeenCalledWith(
      'w',
      'p',
      expect.objectContaining({ kind: 'checkpoint', stage: 'pilot' }),
    );
  });

  it('should start a background run for more than one chunk and finish it chunk by chunk', async () => {
    const { tool, lookupPair, queue, ledger } = build({ rowCount: 30 });

    const output = await tool.execute(
      {
        fromProject: true,
        projectId: 'p',
        roles: ['Head of E-commerce'],
        waitSeconds: 0,
      },
      context,
    );
    const { runId } = output.result as { runId: string };

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(lookupPair).not.toHaveBeenCalled();

    await tool.processRunChunk(runId);
    await tool.processRunChunk(runId);

    const status = await tool.execute({ runId, waitSeconds: 0 }, context);
    const result = status.result as { status: string; done: number };

    expect(result.status).toBe('completed');
    expect(result.done).toBe(30);
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(ledger.append).toHaveBeenCalledWith(
      'w',
      'p',
      expect.objectContaining({ kind: 'checkpoint', stage: 'halfway' }),
    );
    expect(ledger.append).toHaveBeenCalledWith(
      'w',
      'p',
      expect.objectContaining({ kind: 'checkpoint', stage: 'complete' }),
    );
  });

  it('should stop a run on cancel and keep what was looked up', async () => {
    const { tool, lookupPair } = build({ rowCount: 30 });

    const output = await tool.execute(
      {
        fromProject: true,
        projectId: 'p',
        roles: ['Head of E-commerce'],
        waitSeconds: 0,
      },
      context,
    );
    const { runId } = output.result as { runId: string };

    await tool.processRunChunk(runId);

    const cancelled = await tool.execute(
      { runId, cancel: true, waitSeconds: 0 },
      context,
    );

    await tool.processRunChunk(runId);

    expect((cancelled.result as { status: string }).status).toBe('cancelled');
    expect(lookupPair).toHaveBeenCalledTimes(24);
  });
});

describe('FindPeopleByCompanyTool exhaustive budget', () => {
  it('should refuse an exhaustive run without a run cap', async () => {
    const { tool, lookupPair } = build({
      briefExtra: { coverage: 'exhaustive' },
    });

    const output = await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );

    expect(output.success).toBe(false);
    expect(output.error).toMatch(/run cap/);
    expect(lookupPair).not.toHaveBeenCalled();
  });

  it('should look up only what the run cap covers and defer the rest', async () => {
    const { tool, lookupPair, budget } = build({
      rowCount: 4,
      briefExtra: {
        coverage: 'exhaustive',
        capsUsd: { run: 0.03, perPair: 0.01 },
      },
    });
    budget.getStatus.mockResolvedValue({
      runCapUsd: 0.03,
      spentUsd: 0,
      remainingUsd: 0.03,
      exhausted: false,
    });

    const output = await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );
    const result = output.result as {
      deferredByBudget: number;
      budget: { runCapUsd: number; spentUsd: number };
    };

    // The second company is marked unresolvable, so two of the three
    // affordable rows reach the cascade
    expect(lookupPair).toHaveBeenCalledTimes(2);
    expect(result.deferredByBudget).toBe(1);
    expect(result.budget.runCapUsd).toBe(0.03);
    expect(budget.recordSpend).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'w', projectId: 'p', usd: 0.02 }),
    );
  });

  it('should refuse when the run cap is already spent', async () => {
    const { tool, lookupPair, budget } = build({
      briefExtra: {
        coverage: 'exhaustive',
        capsUsd: { run: 0.01, perPair: 0.01 },
      },
    });
    budget.getStatus.mockResolvedValue({
      runCapUsd: 0.01,
      spentUsd: 0.01,
      remainingUsd: 0,
      exhausted: true,
    });

    const output = await tool.execute(
      { fromProject: true, projectId: 'p', roles: ['Head of E-commerce'] },
      context,
    );

    expect(output.success).toBe(false);
    expect(output.error).toMatch(/run budget of \$0.01 is spent/);
    expect(lookupPair).not.toHaveBeenCalled();
  });
});

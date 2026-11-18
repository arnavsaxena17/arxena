import { type SourcingCandidate } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.types';
import { SOURCING_TOOL_ADAPTERS } from 'src/engine/core-modules/candidate-sourcing/sources/tool-adapters';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

const spec: SourcingSpec = {
  hard: [
    { field: 'title', userWords: 'CFO', normalized: ['cfo'] },
    { field: 'company', userWords: 'Zomato', normalized: ['zomato'] },
    { field: 'location', userWords: 'Gurgaon', normalized: ['gurgaon'] },
  ],
  soft: [],
  exclusions: [],
  normalized: { titles: [], industries: [] },
  target: { count: 10 },
  coverage: 'best_effort',
};

const candidate = (
  overrides: Partial<SourcingCandidate> = {},
): SourcingCandidate => ({
  id: 'c',
  source: 'bright-data',
  adapter: 'bright_data_people',
  query: 'CFO Gurgaon',
  fetched: 0,
  newRows: 0,
  qualified: 0,
  spentUsd: 0,
  exhausted: false,
  ...overrides,
});

const base = { spec, projectId: 'p', budgetUsd: 3, remainingTarget: 7 };

describe('sourcing tool adapters', () => {
  it('should estimate then fetch Bright Data within the round share', () => {
    const adapter = SOURCING_TOOL_ADAPTERS.bright_data_people;
    const probe = adapter.build({
      ...base,
      phase: 'probe',
      candidate: candidate(),
    });
    const fetch = adapter.build({
      ...base,
      phase: 'fetch',
      candidate: candidate(),
    });

    expect(probe.args.execute).toBeUndefined();
    expect(fetch.args).toEqual(
      expect.objectContaining({
        execute: true,
        maxBudgetUsd: 3,
        targetCount: 7,
      }),
    );
    expect(
      adapter.read(
        {
          success: true,
          message: '',
          result: {
            estimateCostUsd: 0.04,
            estimatedUniqueRecords: 800,
            totalEstimatedCostUsd: 1.6,
          },
        },
        probe,
      ),
    ).toEqual({
      costUsd: 0.04,
      counts: 800,
      estimatedCostUsd: 1.6,
      hasMore: true,
    });
    expect(
      adapter.read(
        { success: true, message: '', result: { spentUsd: 1.2 } },
        fetch,
      ).hasMore,
    ).toBe(false);
  });

  it('should run people_by_company as one cascade and follow its background run', () => {
    const adapter = SOURCING_TOOL_ADAPTERS.people_by_company;
    const call = adapter.build({
      ...base,
      phase: 'fetch',
      candidate: candidate(),
    });

    expect(call.args).toEqual({
      companies: [{ name: 'Zomato' }],
      roles: ['CFO'],
      location: 'Gurgaon',
      projectId: 'p',
      maxBudgetUsd: 1,
      skipPilot: true,
      waitSeconds: 0,
    });
    expect(
      adapter.read(
        {
          success: true,
          message: '',
          result: { runId: 'r1', status: 'running', spentUsd: 0.2 },
        },
        call,
      ),
    ).toEqual({ costUsd: 0.2, hasMore: false, pendingRunId: 'r1' });
    expect(
      adapter.build({
        ...base,
        phase: 'fetch',
        candidate: candidate({ pendingRunId: 'r1' }),
      }).args,
    ).toEqual({ runId: 'r1', waitSeconds: 0 });
  });
});

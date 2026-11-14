import { type Logger } from '@nestjs/common';

import { type PeopleSearchStrategyResult } from 'src/domains/org-graph/org-chart/build/utils/extract-strategies.util';
import { OrgChartLinkedInScopeRequiredError } from 'src/domains/org-graph/org-chart/errors/orgchart-linkedin-scope-required.error';

import { planStrategiesAndShards } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-strategy-plan.util';

type PlanDeps = Parameters<typeof planStrategiesAndShards>[0];
type PlanInput = Parameters<typeof planStrategiesAndShards>[1];

const strategy = (id: string): PeopleSearchStrategyResult =>
  ({ id, label: id, parameters: {} }) as unknown as PeopleSearchStrategyResult;

// The mocks only have to answer the calls the phase makes, so the deps object
// is assembled loosely and cast once.
const buildDeps = (overrides: Record<string, unknown> = {}): PlanDeps =>
  ({
    logger: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger,
    orgchartLinkedInQueryRouterService: {
      buildOrgchartLinkedInStrategies: jest.fn(async () => ({
        strategies: [strategy('s1')],
      })),
    },
    linkedinParameterResolver: {
      resolveParameterIds: jest.fn(async (parameters: unknown) => parameters),
    },
    linkedInStrategySource: {
      probe: jest.fn(async () => ({ totalCount: 120, pageCount: 25 })),
    },
    orgChartCacheService: {
      getCachedFunctionGradeSearch: jest.fn(async () => null),
    },
    planUnlimitedShards: jest.fn(async () => null),
    ...overrides,
  }) as unknown as PlanDeps;

const buildInput = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  rawQuery: 'sales leaders at Acme',
  cleanedQuery: '',
  requirement: 'sales leaders at Acme',
  searchType: 'classic',
  searchCategory: 'people',
  parameterKey: 'param',
  apiToken: 'token',
  primaryCompanyName: 'Acme',
  primaryCompanyId: 'acme',
  companyNames: [],
  country: 'India',
  functionRoot: 'Sales',
  isAllPeopleInCompanyMode: false,
  linkedinCompanyParameterIds: [],
  linkedinLocationId: '',
  linkedinLocationName: '',
  unlimited: false,
  linkedInAccountId: 'account-1',
  linkedInAccountIdSource: 'workspace',
  emitProgress: jest.fn(async () => undefined),
  ...overrides,
});

describe('planStrategiesAndShards', () => {
  it('should plan the strategies and probe the first page for a count', async () => {
    const deps = buildDeps();
    const input = buildInput();

    const plan = await planStrategiesAndShards(deps, input);

    expect(plan.outcome).toBe('run');
    expect(deps.linkedInStrategySource.probe).toHaveBeenCalledTimes(1);

    if (plan.outcome !== 'run') {
      throw new Error('expected a runnable plan');
    }

    expect(plan.strategiesToRun).toHaveLength(1);
    expect(plan.searchPlan?.threshold).toBeGreaterThan(0);
    expect(plan.maxPages).toBeGreaterThan(0);
    expect(input.emitProgress).toHaveBeenCalledWith(
      'searchPlan',
      expect.objectContaining({ unlimited: false, strategyId: 's1' }),
    );
  });

  it('should run only the strategies under the environment cap', async () => {
    const previous = process.env.ORGCHART_MAX_STRATEGIES;

    process.env.ORGCHART_MAX_STRATEGIES = '2';

    try {
      const deps = buildDeps({
        orgchartLinkedInQueryRouterService: {
          buildOrgchartLinkedInStrategies: jest.fn(async () => ({
            strategies: [strategy('s1'), strategy('s2'), strategy('s3')],
          })),
        },
      });

      const plan = await planStrategiesAndShards(deps, buildInput());

      if (plan.outcome !== 'run') {
        throw new Error('expected a runnable plan');
      }

      expect(plan.strategiesToRun.map((entry) => entry.id)).toEqual([
        's1',
        's2',
      ]);
      expect(plan.maxStrategiesToRun).toBe(2);
    } finally {
      if (previous === undefined) {
        delete process.env.ORGCHART_MAX_STRATEGIES;
      } else {
        process.env.ORGCHART_MAX_STRATEGIES = previous;
      }
    }
  });

  it('should answer from the function-grade cache without probing', async () => {
    const deps = buildDeps({
      orgChartCacheService: {
        getCachedFunctionGradeSearch: jest.fn(async () => ({
          items: [{ id: 'cached-1' }],
          itemCount: 1,
          orgChart: undefined,
        })),
      },
    });

    const plan = await planStrategiesAndShards(
      deps,
      buildInput({ mode: 'function_grade' }),
    );

    expect(plan.outcome).toBe('cached');
    expect(deps.linkedInStrategySource.probe).not.toHaveBeenCalled();

    if (plan.outcome !== 'cached') {
      throw new Error('expected the cached answer');
    }

    expect(plan.result.items).toEqual([{ id: 'cached-1' }]);
    expect(plan.result.cacheSource).toBe('function_grade');
    expect(plan.result.strategyResults).toEqual([
      { strategy: expect.objectContaining({ id: 's1' }), result: null },
    ]);
  });

  it('should return cancelled and probe nothing when the request was cancelled', async () => {
    const deps = buildDeps({ isCancelled: jest.fn(async () => true) });

    const plan = await planStrategiesAndShards(deps, buildInput());

    expect(plan.outcome).toBe('cancelled');
    expect(deps.linkedInStrategySource.probe).not.toHaveBeenCalled();
  });

  it('should refuse a search LinkedIn will not page without a narrower scope', async () => {
    const deps = buildDeps({
      linkedInStrategySource: {
        probe: jest.fn(async () => ({ totalCount: 5000, pageCount: 25 })),
      },
    });

    await expect(
      planStrategiesAndShards(
        deps,
        buildInput({ country: '', functionRoot: '' }),
      ),
    ).rejects.toBeInstanceOf(OrgChartLinkedInScopeRequiredError);
  });

  it('should plan the shards of an unlimited run and run those instead', async () => {
    const shards = [
      {
        key: 'north',
        priority: 1,
        remaining: false,
        facet: 'location' as const,
        includeIds: ['loc-north'],
        excludeIds: [],
        includeLabels: [],
        excludeLabels: [],
        display: [{ id: 'loc-north', title: 'North' }],
      },
      {
        key: 'south',
        priority: 2,
        remaining: false,
        facet: 'location' as const,
        includeIds: ['loc-south'],
        excludeIds: [],
        includeLabels: [],
        excludeLabels: [],
        display: [{ id: 'loc-south', title: 'South' }],
      },
    ];
    const deps = buildDeps({
      linkedInStrategySource: {
        probe: jest.fn(async () => ({ totalCount: 6000, pageCount: 25 })),
      },
      planUnlimitedShards: jest.fn(async () => ({
        plan: {
          primaryDimension: 'location',
          intentSummary: 'split by region',
          rationale: 'too many rows for one search',
          shards,
        },
        compiledShards: shards,
        completedStrategyIds: [],
        collectedProfileKeys: [],
        profilesCollectedSoFar: 0,
        estimatedTotal: 6000,
        updatedAt: new Date().toISOString(),
      })),
    });
    const input = buildInput({ unlimited: true });

    const plan = await planStrategiesAndShards(deps, input);

    if (plan.outcome !== 'run') {
      throw new Error('expected a runnable plan');
    }

    expect(deps.planUnlimitedShards).toHaveBeenCalledTimes(1);
    expect(plan.strategiesToRun).toHaveLength(2);
    expect(plan.unlimitedProgress).not.toBeNull();
    expect(input.emitProgress).toHaveBeenCalledWith(
      'unlimitedShardPlan',
      expect.objectContaining({ primaryDimension: 'location' }),
    );
  });

  it('should keep going without a pre-flight count when the probe fails', async () => {
    const deps = buildDeps({
      linkedInStrategySource: {
        probe: jest.fn(async () => {
          throw new Error('linkedin is down');
        }),
      },
    });

    const plan = await planStrategiesAndShards(deps, buildInput());

    if (plan.outcome !== 'run') {
      throw new Error('expected a runnable plan');
    }

    expect(plan.searchPlan).toBeUndefined();
    expect(plan.maxPages).toBeGreaterThan(0);
  });
});

import { type BrightDataLudicrousPlan } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { BrightDataLudicrousExecutorService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-executor.service';
import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';

const document = (brightId: string) => ({
  brightId,
  data: { name: brightId },
});

const plan = {
  projectId: 'project-1',
  workspaceId: 'workspace-1',
  entity: 'company',
  rawQuery: 'hospitals in Mumbai',
  intentSummary: 'hospitals',
  relevanceCriteria: 'A hospital in Mumbai',
  needsSemanticCheck: true,
  rubric: {
    titleIncludePatterns: [],
    titleExcludePatterns: [],
    industryIncludePatterns: [],
    countryCodes: [],
    companySizeFromBuckets: [],
  },
  shards: [
    {
      key: 'mumbai',
      rationale: 'all',
      priority: 1,
      query: { equals: { headquarters_country_code: 'IN' } },
    },
  ],
  estimates: [
    {
      shardKey: 'mumbai',
      rationale: 'all',
      priority: 1,
      matched: 10,
      coveragePercent: 100,
      fetchableRecords: 10,
      estimatedCostUsd: 0.02,
      sampleSize: 5,
      samplePrecision: 1,
    },
  ],
  sampleDocuments: {
    mumbai: ['kept-1', 'kept-2', 'kept-3', 'kept-4', 'kept-5'].map(document),
  },
  fields: ['name'],
  totalFetchableRecords: 10,
  estimatedUniqueRecords: 10,
  estimatedAccurateRecords: 10,
  totalEstimatedCostUsd: 0.02,
  estimateCostUsd: 0.01,
  createdAt: '2026-10-13T00:00:00.000Z',
} as BrightDataLudicrousPlan;

describe('BrightDataLudicrousExecutorService', () => {
  it('should keep dropped rows and their Jev answers with the fetched page', async () => {
    const searchPage = jest.fn(async () => ({
      documents: ['drop-1', 'drop-2', 'drop-3', 'drop-4', 'drop-5'].map(
        document,
      ),
    }));
    const judge = jest.fn(
      async ({ documents }: { documents: Array<{ brightId: string }> }) => ({
        verdicts: documents.map((row) => ({
          brightId: row.brightId,
          relevant: row.brightId.startsWith('kept'),
        })),
        precision: documents.every((row) => row.brightId.startsWith('kept'))
          ? 1
          : 0,
        judgedBy: 'jev' as const,
      }),
    );
    const executor = new BrightDataLudicrousExecutorService(
      { searchPage } as never,
      { judge } as never,
      {
        validateCreditsOrThrow: jest.fn(),
        billRecords: jest.fn(),
      } as never,
    );

    const result = await executor.execute({ plan, maxBudgetUsd: 1 });

    expect(result.documents.map((row) => row.brightId)).toEqual([
      'kept-1',
      'kept-2',
      'kept-3',
      'kept-4',
      'kept-5',
    ]);
    expect(result.fetchedDocuments).toEqual([
      ...['kept-1', 'kept-2', 'kept-3', 'kept-4', 'kept-5'].map((brightId) => ({
        ...document(brightId),
        relevant: true,
      })),
      ...['drop-1', 'drop-2', 'drop-3', 'drop-4', 'drop-5'].map((brightId) => ({
        ...document(brightId),
        relevant: false,
      })),
    ]);
    expect(result.shardReports[0]?.stoppedReason).toBe('exhausted');
  });

  it('should not charge for a page that was replayed from the cache', async () => {
    const billRecords = jest.fn();
    const searchPage = jest.fn(async () => ({
      documents: [document('cached-1')],
      fromCache: true,
    }));
    const executor = new BrightDataLudicrousExecutorService(
      { searchPage } as never,
      { judge: jest.fn() } as never,
      {
        validateCreditsOrThrow: jest.fn(),
        billRecords,
      } as never,
    );

    const result = await executor.execute({
      plan: {
        ...plan,
        needsSemanticCheck: false,
        sampleDocuments: {},
        estimates: [{ ...plan.estimates[0], matched: 2, fetchableRecords: 2 }],
      },
      maxBudgetUsd: 1,
    });

    // The row is already paid for: no provider cost, no credit charge
    expect(billRecords).not.toHaveBeenCalled();
    expect(result.shardReports[0]?.costUsd).toBe(0);
    expect(result.spentUsd).toBe(plan.estimateCostUsd);
    expect(result.fetchedDocuments.map((row) => row.brightId)).toEqual([
      'cached-1',
    ]);
  });

  it('should fetch the next page when Jev precision is low', async () => {
    let call = 0;
    const searchPage = jest.fn(async ({ limit }: { limit: number }) => {
      call += 1;
      const prefix = call === 1 ? 'drop' : 'later';

      return {
        documents: Array.from({ length: limit }, (_, index) =>
          document(`${prefix}-${index + 1}`),
        ),
      };
    });
    const judge = jest.fn(
      async ({ documents }: { documents: Array<{ brightId: string }> }) => ({
        verdicts: documents.map((row) => ({
          brightId: row.brightId,
          relevant: row.brightId.startsWith('kept'),
        })),
        precision: documents.every((row) => row.brightId.startsWith('kept'))
          ? 1
          : 0,
        judgedBy: 'jev' as const,
      }),
    );
    const executor = new BrightDataLudicrousExecutorService(
      { searchPage } as never,
      { judge } as never,
      {
        validateCreditsOrThrow: jest.fn(),
        billRecords: jest.fn(),
      } as never,
    );

    const result = await executor.execute({
      plan: {
        ...plan,
        estimates: [
          {
            ...plan.estimates[0],
            matched: 205,
            fetchableRecords: 205,
          },
        ],
      },
      maxBudgetUsd: 1,
    });

    expect(searchPage).toHaveBeenCalledTimes(2);
    expect(result.shardReports[0]?.stoppedReason).toBe('exhausted');
    expect(result.documents.map((row) => row.brightId)).toEqual([
      'kept-1',
      'kept-2',
      'kept-3',
      'kept-4',
      'kept-5',
    ]);
    expect(
      result.fetchedDocuments.some((row) => row.brightId === 'drop-1'),
    ).toBe(true);
    expect(
      result.fetchedDocuments.some((row) => row.brightId === 'later-1'),
    ).toBe(true);
  });
});

describe('BrightDataLudicrousSearchService', () => {
  it('should save the fetched page when the judge keeps nothing', async () => {
    const save = jest.fn();
    const service = new BrightDataLudicrousSearchService(
      {} as never,
      {
        execute: jest.fn(async () => ({
          projectId: 'project-1',
          entity: 'company',
          documents: [],
          fetchedDocuments: [
            { brightId: 'dropped', data: { name: 'Clinic' }, relevant: false },
          ],
          spentUsd: 0.01,
          budgetUsd: 1,
          shardReports: [],
        })),
      } as never,
      {
        load: jest.fn(async () => ({ projectId: 'project-1' })),
        clear: jest.fn(),
      } as never,
      { save } as never,
    );

    await service.executePlan({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      entity: 'company',
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        documents: [],
        fetchedDocuments: [
          expect.objectContaining({ brightId: 'dropped', relevant: false }),
        ],
      }),
    );
  });
});

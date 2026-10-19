import { BrightDataLudicrousRelevanceJudgeService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-relevance-judge.service';
import { type FilterSpec } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { FITMENT_THRESHOLD_ENV } from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-threshold.util';

const rubric = {
  titleIncludePatterns: [],
  titleExcludePatterns: [],
  industryIncludePatterns: [],
  countryCodes: [],
  companySizeFromBuckets: [],
};

describe('BrightDataLudicrousRelevanceJudgeService', () => {
  const original = process.env[FITMENT_THRESHOLD_ENV];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[FITMENT_THRESHOLD_ENV];
    } else {
      process.env[FITMENT_THRESHOLD_ENV] = original;
    }
  });

  it('should judge relevance at the server fitment threshold', async () => {
    process.env[FITMENT_THRESHOLD_ENV] = '65%';

    let seen: FilterSpec | undefined;
    const run = jest.fn(async (_records: unknown[], spec: FilterSpec) => {
      seen = spec;

      return {
        verdicts: [
          {
            id: 'b1',
            status: 'answered' as const,
            answers: { relevant: true },
            keep: true,
          },
        ],
        stats: {},
      };
    });
    const service = new BrightDataLudicrousRelevanceJudgeService({
      run,
    } as never);

    const judgement = await service.judge({
      entity: 'people',
      documents: [
        { brightId: 'b1', data: { name: 'A', current_title: 'CEO' } },
      ],
      relevanceCriteria: 'CEOs',
      rubric,
    });

    expect(seen?.probabilityThreshold).toBeCloseTo(0.65);
    expect(judgement).toMatchObject({ judgedBy: 'jev', precision: 1 });
  });
});

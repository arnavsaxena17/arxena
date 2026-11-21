import { BrightDataLudicrousRelevanceJudgeService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-relevance-judge.service';
import { type JudgementSpec } from 'src/engine/core-modules/judge/judge.service';
import { FITMENT_THRESHOLD_ENV } from 'src/engine/core-modules/judge/fitment-threshold.util';

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

    let seen: JudgementSpec | undefined;
    const judgeStage = jest.fn(async (rows: Array<{ id: string }>, spec: JudgementSpec) => {
      seen = spec;

      return {
        results: new Map(
          rows.map((row) => [
            row.id,
            {
              score: 1,
              outcome: 'pass' as const,
              threshold: spec.threshold ?? 0.5,
              failedMustHaves: [],
              unknownKeys: [],
              verdicts: { relevant: 'pass' },
              reason: 'matches',
            },
          ]),
        ),
        stats: {},
      };
    });
    const service = new BrightDataLudicrousRelevanceJudgeService({
      judgeStage,
    } as never);

    const judgement = await service.judge({
      entity: 'people',
      documents: [
        { brightId: 'b1', data: { name: 'A', current_title: 'CEO' } },
      ],
      relevanceCriteria: 'CEOs',
      rubric,
    });

    expect(seen?.threshold).toBeCloseTo(0.65);
    expect(judgement).toMatchObject({ judgedBy: 'jev', precision: 1 });
  });
});

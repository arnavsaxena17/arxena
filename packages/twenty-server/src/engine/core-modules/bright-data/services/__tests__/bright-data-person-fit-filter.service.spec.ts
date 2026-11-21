import { BrightDataPersonFitFilterService } from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import { type JudgementOutcome } from 'src/engine/core-modules/judge/judge.service';
import { FITMENT_THRESHOLD_ENV } from 'src/engine/core-modules/judge/fitment-threshold.util';

const people = [
  {
    id: 'a',
    name: 'Asha Rao',
    title: 'CEO',
    company: 'Acme',
    location: 'Pune',
  },
];

const profiled = [
  {
    ...people[0],
    profile: { experience: [] },
  },
];

type Verdicts = Record<string, string>;

// Stands in for judgeStage: the service under test is the mapping from the
// judge's verdicts to a judgement, not the model call itself.
const judgeWith = (
  verdicts: Verdicts | undefined,
  outcome: 'pass' | 'fail' | 'unknown' = 'pass',
) => {
  const judgeStage = jest.fn(
    async (rows: Array<{ id: string }>, _spec: unknown) => ({
    results:
      verdicts === undefined
        ? new Map<string, JudgementOutcome>()
        : new Map<string, JudgementOutcome>(
            rows.map((row) => [
              row.id,
              {
                score: outcome === 'pass' ? 1 : 0,
                outcome,
                threshold: 0.5,
                failedMustHaves: [],
                unknownKeys: [],
                verdicts,
                reason: 'reason',
              },
            ]),
          ),
      stats: {},
    }),
  );

  return {
    service: new BrightDataPersonFitFilterService({ judgeStage } as never),
    judgeStage,
  };
};

describe('BrightDataPersonFitFilterService fitment threshold', () => {
  const original = process.env[FITMENT_THRESHOLD_ENV];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[FITMENT_THRESHOLD_ENV];
    } else {
      process.env[FITMENT_THRESHOLD_ENV] = original;
    }
  });

  it('should pass the server bar to the judge, and no lower one', async () => {
    process.env[FITMENT_THRESHOLD_ENV] = '65%';

    const { service, judgeStage } = judgeWith({ fits: 'pass' });

    await service.screen({ workspaceId: 'w', query: 'CEOs in Pune', people });

    expect(judgeStage.mock.calls[0]?.[1]).toMatchObject({
      threshold: 0.65,
      stage: 'snapshot',
    });
  });

  it('should give each yes/no question its own bar', async () => {
    const { service, judgeStage } = judgeWith({ fits: 'pass' });

    await service.screen({ workspaceId: 'w', query: 'q', people: profiled });

    expect(
      (judgeStage.mock.calls[0]?.[1] as { fieldThresholds: unknown })
        .fieldThresholds,
    ).toEqual({
      fits: 0.5,
      fake: 0.5,
    });
  });

  it('should treat a person the judge rejected as not fitting', async () => {
    const { service } = judgeWith({ fits: 'fail' }, 'fail');

    const judgements = await service.screen({
      workspaceId: 'w',
      query: 'CEOs in Pune',
      people,
    });

    expect(judgements.get('a')?.fitsSearch).toBe(false);
    expect(judgements.get('a')?.fitment.outcome).toBe('fail');
  });

  it('should give the benefit of the doubt when the judge gives no fit answer', async () => {
    const { service } = judgeWith({});

    const judgements = await service.screen({
      workspaceId: 'w',
      query: 'q',
      people,
    });

    expect(judgements.get('a')?.fitsSearch).toBe(true);
  });

  it('should leave a person the judge did not answer out of the result', async () => {
    const { service } = judgeWith(undefined);

    const judgements = await service.screen({
      workspaceId: 'w',
      query: 'q',
      people,
    });

    expect(judgements.size).toBe(0);
  });

  it('should send a search row whose company is unknown to a profile fetch, and fail the same row with a profile', async () => {
    const verdicts = { fits: 'pass', company: 'unknown', role: 'exact' };

    const fromSearch = judgeWith(verdicts);
    const searchJudgements = await fromSearch.service.judge({
      workspaceId: 'w',
      company: 'Acme',
      alternateNames: [],
      roles: ['CEO'],
      candidates: people,
    });

    // A snapshot leaves the unknown company for the profile fetch
    expect(searchJudgements.get('a')?.fitment.outcome).toBe('unknown');

    const fromProfile = judgeWith(verdicts);
    const profileJudgements = await fromProfile.service.judge({
      workspaceId: 'w',
      company: 'Acme',
      alternateNames: [],
      roles: ['CEO'],
      candidates: profiled,
    });

    // With the full profile there is nothing left to fetch, so unknown fails
    expect(profileJudgements.get('a')?.fitment.outcome).toBe('fail');
  });
});

describe('BrightDataPersonFitFilterService other thresholds', () => {
  const saved = {
    fake: process.env.SOURCING_FAKE_PROFILE_THRESHOLD,
    same: process.env.SOURCING_SAME_PERSON_THRESHOLD,
  };

  afterEach(() => {
    for (const [name, value] of [
      ['SOURCING_FAKE_PROFILE_THRESHOLD', saved.fake],
      ['SOURCING_SAME_PERSON_THRESHOLD', saved.same],
    ] as const) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('should flag a fake profile from the judge verdict', async () => {
    const { service } = judgeWith({ fits: 'pass', fake: 'pass' });

    const judgements = await service.screen({
      workspaceId: 'w',
      query: 'q',
      people: profiled,
    });

    expect(judgements.get('a')?.likelyFake).toBe(true);
  });

  it('should not flag a coherent profile', async () => {
    const { service } = judgeWith({ fits: 'pass', fake: 'fail' });

    const judgements = await service.screen({
      workspaceId: 'w',
      query: 'q',
      people: profiled,
    });

    expect(judgements.get('a')?.likelyFake).toBe(false);
  });

  it('should merge two rows only when the judge says they are one person', async () => {
    const duplicates = [
      { id: 'x', name: 'Asha Rao', title: 'CEO', company: 'Acme', linkedinUrl: 'u1' },
      { id: 'y', name: 'Asha Rao', title: 'CEO', company: 'Acme', linkedinUrl: '' },
    ];

    const merged = judgeWith({ same: 'pass' }, 'pass');
    expect(
      (
        await merged.service.findDuplicates({
          workspaceId: 'w',
          people: duplicates,
        })
      ).get('y'),
    ).toBe('x');

    const notMerged = judgeWith({ same: 'fail' }, 'fail');
    expect(
      (
        await notMerged.service.findDuplicates({
          workspaceId: 'w',
          people: duplicates,
        })
      ).size,
    ).toBe(0);
  });

  it('should ask the same-person question at its own bar', async () => {
    process.env.SOURCING_SAME_PERSON_THRESHOLD = '0.9';

    const { service, judgeStage } = judgeWith({ same: 'pass' });

    await service.findDuplicates({
      workspaceId: 'w',
      people: [
        { id: 'x', name: 'Asha Rao', title: 'CEO', company: 'Acme', linkedinUrl: 'u1' },
        { id: 'y', name: 'Asha Rao', title: 'CEO', company: 'Acme', linkedinUrl: '' },
      ],
    });

    expect(
      (judgeStage.mock.calls[0]?.[1] as { threshold: number }).threshold,
    ).toBeCloseTo(0.9);
  });
});

import {
  BrightDataPersonFitFilterService,
  scorePersonFitment,
} from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import { FITMENT_THRESHOLD_ENV } from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-threshold.util';

const people = [
  {
    id: 'a',
    name: 'Asha Rao',
    title: 'CEO',
    company: 'Acme',
    location: 'Pune',
  },
];

const screenWith = async (probabilityOfFit: number) => {
  const decide = jest.fn().mockResolvedValue({
    p0__fits: { type: 'noul', noul: probabilityOfFit },
  });
  const service = new BrightDataPersonFitFilterService({ decide } as never);

  return service.screen({ workspaceId: 'w', query: 'CEOs in Pune', people });
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

  it('should treat a 70% fit as a fit at the default bar', async () => {
    delete process.env[FITMENT_THRESHOLD_ENV];

    const judgements = await screenWith(0.7);

    expect(judgements.get('a')?.fitsSearch).toBe(true);
    expect(judgements.get('a')?.fitment.outcome).toBe('pass');
  });

  it('should reject the same 70% fit when the server raises the bar to 80%', async () => {
    process.env[FITMENT_THRESHOLD_ENV] = '0.8';

    const judgements = await screenWith(0.7);

    expect(judgements.get('a')?.fitsSearch).toBe(false);
    expect(judgements.get('a')?.fitment.outcome).toBe('fail');
  });

  it('should give the benefit of the doubt when the model gives no fit answer', async () => {
    const decide = jest.fn().mockResolvedValue({});
    const service = new BrightDataPersonFitFilterService({ decide } as never);
    const judgements = await service.screen({
      workspaceId: 'w',
      query: 'q',
      people,
    });

    expect(judgements.get('a')?.fitsSearch).toBe(true);
    expect(judgements.get('a')?.fitment.outcome).toBe('pass');
  });
});

describe('scorePersonFitment', () => {
  const base = { fits: true, withCompanyAndRole: true, hasProfile: true };

  it('should pass a person at the same company in the exact role', () => {
    expect(
      scorePersonFitment({ ...base, company: 'same', role: 'exact' }).outcome,
    ).toBe('pass');
  });

  it('should count a related company and a related role as a pass', () => {
    expect(
      scorePersonFitment({ ...base, company: 'related', role: 'related' })
        .outcome,
    ).toBe('pass');
  });

  it('should fail a namesake at a different company', () => {
    const result = scorePersonFitment({
      ...base,
      company: 'different',
      role: 'exact',
    });

    expect(result.outcome).toBe('fail');
    expect(result.failedMustHaves).toEqual(['company']);
  });

  it('should send a search-result person with an unknown company to a profile fetch', () => {
    expect(
      scorePersonFitment({
        ...base,
        hasProfile: false,
        company: 'unknown',
        role: 'exact',
      }).outcome,
    ).toBe('unknown');
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

  const profiled = [
    {
      id: 'a',
      name: 'Asha Rao',
      title: 'CEO',
      company: 'Acme',
      location: 'Pune',
      profile: { experience: [] },
    },
  ];

  const screenFake = async (probability: number) => {
    const decide = jest.fn().mockResolvedValue({
      p0__fits: { type: 'noul', noul: 0.9 },
      p0__fake: { type: 'noul', noul: probability },
    });
    const service = new BrightDataPersonFitFilterService({ decide } as never);

    return service.screen({ workspaceId: 'w', query: 'q', people: profiled });
  };

  it('should flag a 60% fake at the default bar and not at a stricter one', async () => {
    delete process.env.SOURCING_FAKE_PROFILE_THRESHOLD;
    expect((await screenFake(0.6)).get('a')?.likelyFake).toBe(true);

    process.env.SOURCING_FAKE_PROFILE_THRESHOLD = '0.8';
    expect((await screenFake(0.6)).get('a')?.likelyFake).toBe(false);
  });

  it('should merge two rows only when the same-person probability clears its own bar', async () => {
    const people = [
      {
        id: 'x',
        name: 'Asha Rao',
        title: 'CEO',
        company: 'Acme',
        linkedinUrl: 'u1',
      },
      {
        id: 'y',
        name: 'Asha Rao',
        title: 'CEO',
        company: 'Acme',
        linkedinUrl: '',
      },
    ];
    const findWith = async (probability: number) => {
      const decide = jest
        .fn()
        .mockResolvedValue({
          pair0__same: { type: 'noul', noul: probability },
        });

      return new BrightDataPersonFitFilterService({
        decide,
      } as never).findDuplicates({ workspaceId: 'w', people });
    };

    delete process.env.SOURCING_SAME_PERSON_THRESHOLD;
    expect((await findWith(0.7)).size).toBe(1);

    process.env.SOURCING_SAME_PERSON_THRESHOLD = '0.9';
    expect((await findWith(0.7)).size).toBe(0);
  });
});

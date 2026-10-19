import {
  describeFitment,
  scoreFitment,
  type FitmentCriterion,
} from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-score.util';

const criteria: FitmentCriterion[] = [
  {
    key: 'isPlantHead',
    description: 'heads a plant',
    mustHave: true,
    weight: 2,
  },
  {
    key: 'inChemicals',
    description: 'works in chemicals',
    mustHave: true,
    weight: 1,
  },
  {
    key: 'inIndia',
    description: 'is based in India',
    mustHave: false,
    weight: 1,
  },
];

const score = (
  verdicts: Record<string, string>,
  stage: 'snapshot' | 'profile',
  threshold = 0.5,
) => scoreFitment({ criteria, verdicts, stage, threshold });

describe('scoreFitment', () => {
  it('should pass a row that clears every criterion', () => {
    const result = score(
      { isPlantHead: 'pass', inChemicals: 'pass', inIndia: 'pass' },
      'profile',
    );

    expect(result).toMatchObject({ score: 1, outcome: 'pass' });
  });

  it('should fail a row that fails a must-have, whatever its score', () => {
    const result = score(
      { isPlantHead: 'fail', inChemicals: 'pass', inIndia: 'pass' },
      'profile',
    );

    expect(result.outcome).toBe('fail');
    expect(result.failedMustHaves).toEqual(['isPlantHead']);
  });

  it('should let a failed nice-to-have lower the score without failing the row', () => {
    const result = score(
      { isPlantHead: 'pass', inChemicals: 'pass', inIndia: 'fail' },
      'profile',
    );

    expect(result.score).toBeCloseTo(0.75);
    expect(result.outcome).toBe('pass');
  });

  it('should fail a row below the threshold', () => {
    const result = score(
      { isPlantHead: 'pass', inChemicals: 'pass', inIndia: 'fail' },
      'profile',
      0.8,
    );

    expect(result.outcome).toBe('fail');
  });

  describe('on a snapshot', () => {
    it('should send a row with an unknown criterion to the profile fetch', () => {
      const result = score(
        { isPlantHead: 'pass', inChemicals: 'unknown', inIndia: 'pass' },
        'snapshot',
      );

      expect(result.outcome).toBe('unknown');
      expect(result.unknownKeys).toEqual(['inChemicals']);
    });

    it('should score only what could be judged', () => {
      const result = score(
        { isPlantHead: 'pass', inChemicals: 'unknown', inIndia: 'unknown' },
        'snapshot',
      );

      expect(result.score).toBe(1);
    });

    it('should fail a row that cannot reach the threshold even if every unknown passed', () => {
      const result = score(
        { isPlantHead: 'pass', inChemicals: 'unknown', inIndia: 'fail' },
        'snapshot',
        0.9,
      );

      expect(result.outcome).toBe('fail');
    });

    it('should pass a fully judged row that clears the bar', () => {
      const result = score(
        { isPlantHead: 'pass', inChemicals: 'pass', inIndia: 'pass' },
        'snapshot',
      );

      expect(result.outcome).toBe('pass');
    });
  });

  describe('on the full profile', () => {
    it('should fail a row whose must-have is still unknown', () => {
      const result = score(
        { isPlantHead: 'pass', inChemicals: 'unknown', inIndia: 'pass' },
        'profile',
      );

      expect(result.outcome).toBe('fail');
    });

    it('should count an unknown nice-to-have against the score', () => {
      const result = score(
        { isPlantHead: 'pass', inChemicals: 'pass', inIndia: 'unknown' },
        'profile',
      );

      expect(result.score).toBeCloseTo(0.75);
      expect(result.outcome).toBe('pass');
    });
  });

  it('should read a missing or invalid verdict as unknown, not fail', () => {
    const result = score(
      { isPlantHead: 'pass', inChemicals: 'maybe' },
      'snapshot',
    );

    expect(result.unknownKeys).toEqual(['inChemicals', 'inIndia']);
    expect(result.failedMustHaves).toEqual([]);
  });

  it('should fail when there are no criteria', () => {
    expect(
      scoreFitment({
        criteria: [],
        verdicts: {},
        stage: 'profile',
        threshold: 0.5,
      }).outcome,
    ).toBe('fail');
  });
});

describe('describeFitment', () => {
  it("should name the failed must-have in the user's words", () => {
    const result = score(
      { isPlantHead: 'fail', inChemicals: 'pass', inIndia: 'pass' },
      'profile',
    );

    expect(describeFitment(result, criteria)).toContain('heads a plant');
  });

  it('should say a snapshot row needs the full profile', () => {
    const result = score(
      { isPlantHead: 'pass', inChemicals: 'unknown', inIndia: 'pass' },
      'snapshot',
    );

    expect(describeFitment(result, criteria)).toContain(
      'Needs the full profile',
    );
  });
});

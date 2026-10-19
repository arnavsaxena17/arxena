import {
  buildFitmentColumnFields,
  buildFitmentModelFields,
  buildFitmentPrompt,
  computeFitmentColumns,
  FITMENT_EVIDENCE_KEY,
  FITMENT_OUTCOME_KEY,
  FITMENT_REASON_KEY,
  FITMENT_SCORE_KEY,
} from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-filter.util';
import { type FitmentCriterion } from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-score.util';

const criteria: FitmentCriterion[] = [
  { key: 'isCeo', description: 'is a CEO', mustHave: true, weight: 1 },
  {
    key: 'inFintech',
    description: 'works in fintech',
    mustHave: false,
    weight: 1,
  },
];

describe('fitment filter', () => {
  it('should ask the model for a verdict per criterion and an evidence line', () => {
    const fields = buildFitmentModelFields(criteria);

    expect(fields.map((field) => field.name)).toEqual([
      'isCeo',
      'inFintech',
      FITMENT_EVIDENCE_KEY,
    ]);
    expect(fields[0]).toMatchObject({
      type: 'enum',
      enumValues: ['pass', 'fail', 'unknown'],
    });
    expect(fields[2].optional).toBe(true);
  });

  it('should show the computed columns first, then the verdicts', () => {
    expect(
      buildFitmentColumnFields(criteria).map((field) => field.name),
    ).toEqual([
      FITMENT_OUTCOME_KEY,
      FITMENT_SCORE_KEY,
      FITMENT_REASON_KEY,
      'isCeo',
      'inFintech',
    ]);
  });

  it('should tell the model a snapshot cannot answer everything', () => {
    const prompt = buildFitmentPrompt({
      stage: 'snapshot',
      criteria,
      request: 'CEOs of fintechs',
    });

    expect(prompt).toContain('CEOs of fintechs');
    expect(prompt).toContain('unknown, never fail');
    expect(prompt).toContain('isCeo (must-have)');
    expect(prompt).toContain('inFintech (nice-to-have)');
  });

  it('should compute the score and the outcome in code, not take them from the model', () => {
    const { values, result } = computeFitmentColumns({
      answers: {
        isCeo: 'pass',
        inFintech: 'fail',
        // A model that tries to decide for itself is ignored
        [FITMENT_OUTCOME_KEY]: 'pass',
        [FITMENT_EVIDENCE_KEY]: 'Title says Chief Executive Officer',
      },
      setup: { stage: 'profile', criteria, threshold: 0.8 },
    });

    expect(result.outcome).toBe('fail');
    expect(values[FITMENT_OUTCOME_KEY]).toBe('fail');
    expect(values[FITMENT_SCORE_KEY]).toBe(50);
    expect(values[FITMENT_REASON_KEY]).toContain('Below the bar');
    expect(values[FITMENT_REASON_KEY]).toContain(
      'Title says Chief Executive Officer',
    );
  });

  it('should leave a snapshot row with an unknown criterion as unknown', () => {
    const { values } = computeFitmentColumns({
      answers: { isCeo: 'pass', inFintech: 'unknown' },
      setup: { stage: 'snapshot', criteria, threshold: 0.5 },
    });

    expect(values[FITMENT_OUTCOME_KEY]).toBe('unknown');
  });
});

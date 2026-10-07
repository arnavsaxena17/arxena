import {
  buildVerdict,
  type FilterFieldSpec,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';

const fields: FilterFieldSpec[] = [
  { name: 'keep', type: 'boolean' },
  { name: 'confidence', type: 'enum', enumValues: ['strong', 'borderline'] },
  { name: 'reason', type: 'text', optional: true },
];
const spec = { fields, keepField: 'keep' };

describe('buildVerdict', () => {
  it('accepts a complete answer and surfaces the reason', () => {
    expect(
      buildVerdict({
        id: 'a',
        raw: { keep: true, confidence: 'strong', reason: 'VP Sales at target' },
        spec,
      }),
    ).toEqual({
      id: 'a',
      status: 'answered',
      keep: true,
      answers: {
        keep: true,
        confidence: 'strong',
        reason: 'VP Sales at target',
      },
      reason: 'VP Sales at target',
    });
  });

  it('coerces yes/no strings and enum case', () => {
    const verdict = buildVerdict({
      id: 'a',
      raw: { keep: 'Yes', confidence: 'STRONG' },
      spec,
    });

    expect(verdict.status).toBe('answered');
    expect(verdict.answers).toEqual({ keep: true, confidence: 'strong' });
  });

  it('fails (never defaults to false) when a required field is missing', () => {
    const verdict = buildVerdict({
      id: 'a',
      raw: { confidence: 'strong' },
      spec,
    });

    expect(verdict.status).toBe('failed');
    expect(verdict.keep).toBeNull();
  });

  it('fails when an enum answer is outside the allowed values', () => {
    const verdict = buildVerdict({
      id: 'a',
      raw: { keep: true, confidence: 'weak' },
      spec,
    });

    expect(verdict.status).toBe('failed');
    expect(verdict.error).toContain('confidence');
  });

  it('does not require optional text fields', () => {
    expect(
      buildVerdict({
        id: 'a',
        raw: { keep: false, confidence: 'strong' },
        spec,
      }).status,
    ).toBe('answered');
  });

  it('fails on a null answer', () => {
    expect(buildVerdict({ id: 'a', raw: null, spec }).status).toBe('failed');
  });
});

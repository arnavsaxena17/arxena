import {
  estimateFilterTokens,
  mergeVerdicts,
  toFilterSpec,
  type CandidateFilterConfig,
  type CandidateFilterResult,
} from 'src/domains/ingestion/candidate-sourcing/services/ai-filter-engine/candidate-filter-spec.util';

const config = (
  overrides: Partial<CandidateFilterConfig> = {},
): CandidateFilterConfig => ({
  modelName: 'Seniority',
  prompt: 'Is this person a VP or above?',
  selectedModel: 'gpt6luna',
  fields: [
    { name: 'isSenior', type: 'boolean' },
    { name: 'band', type: 'enum', enumValues: ['vp', 'cxo'] },
    { name: 'why', type: 'string' },
  ],
  selectedMetadataFields: ['jobTitle', 'resume'],
  ...overrides,
});

describe('toFilterSpec', () => {
  it('should describe a column filter: fields, no keep decision', () => {
    expect(toFilterSpec(config())).toEqual({
      name: 'Seniority',
      subject: 'person',
      criteria: 'Is this person a VP or above?',
      fields: [
        { name: 'isSenior', type: 'boolean' },
        { name: 'band', type: 'enum', enumValues: ['vp', 'cxo'] },
        { name: 'why', type: 'text' },
      ],
      model: 'gpt6luna',
      metadataFields: ['jobTitle'],
    });
  });

  it('should send the resume only when asked to', () => {
    expect(
      toFilterSpec(config({ includeResume: true })).metadataFields,
    ).toEqual(['jobTitle', 'resume']);
  });

  it('should read an enum with no values as text', () => {
    expect(
      toFilterSpec(config({ fields: [{ name: 'band', type: 'enum' }] })).fields,
    ).toEqual([{ name: 'band', type: 'text' }]);
  });
});

describe('mergeVerdicts', () => {
  it('should merge answers per candidate and skip a failed verdict', () => {
    const results = new Map<string, CandidateFilterResult>();

    mergeVerdicts(results, [
      { id: 'a', status: 'answered', answers: { isSenior: true }, keep: null },
      { id: 'b', status: 'failed', answers: { isSenior: false }, keep: null },
    ]);
    mergeVerdicts(results, [
      { id: 'a', status: 'answered', answers: { region: 'EMEA' }, keep: null },
    ]);

    expect([...results.values()]).toEqual([
      { candidateId: 'a', enrichedData: { isSenior: true, region: 'EMEA' } },
      { candidateId: 'b', enrichedData: {} },
    ]);
  });
});

describe('estimateFilterTokens', () => {
  it('should count every candidate against every filter', () => {
    const estimate = estimateFilterTokens(
      [{ jobTitle: 'VP Sales' }, { jobTitle: 'CFO' }],
      [config()],
    );

    expect(estimate.totalCandidates).toBe(2);
    expect(estimate.totalOutputTokens).toBe(2 * Math.ceil((3 * 50) / 4));
    expect(estimate.totalInputTokens).toBeGreaterThan(0);
  });
});

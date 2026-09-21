import {
  aiFilteringFieldsToOutputSchema,
  WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES,
} from '../ai-filtering-output-schema.util';

describe('aiFilteringFieldsToOutputSchema', () => {
  it('maps boolean and enum-like fields into output schema leaves', () => {
    const outputSchema = aiFilteringFieldsToOutputSchema([
      {
        name: 'isSeniorGtm',
        type: 'boolean',
        description: 'Senior GTM',
      },
      {
        name: 'fitBand',
        type: 'enum',
        enumValues: ['strong', 'maybe', 'no'],
      },
    ]);

    expect(outputSchema.candidates).toEqual({
      isLeaf: true,
      type: 'array',
      label: 'Candidates',
      value: null,
    });
    expect(outputSchema.isSeniorGtm).toEqual({
      isLeaf: true,
      type: 'boolean',
      label: 'isSeniorGtm',
      value: null,
    });
    expect(outputSchema.fitBand).toEqual({
      isLeaf: true,
      type: 'string',
      label: 'fitBand',
      value: null,
    });
  });
});

describe('WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES', () => {
  it('provides two sample people for drawer Test tab', () => {
    expect(WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES).toHaveLength(2);
    expect(WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES[0].name).toBe('Arapa Hara');
  });
});

import { aiFilteringFieldsToOutputSchema } from 'twenty-shared/workflow';

describe('aiFilteringFieldsToOutputSchema dual-write', () => {
  it('exposes structured field leaves for IF/ELSE variable pickers', () => {
    const outputSchema = aiFilteringFieldsToOutputSchema([
      { name: 'isSeniorGtm', type: 'boolean' },
    ]);

    expect(outputSchema.isSeniorGtm?.isLeaf).toBe(true);
    expect(outputSchema.candidates?.type).toBe('array');
  });
});

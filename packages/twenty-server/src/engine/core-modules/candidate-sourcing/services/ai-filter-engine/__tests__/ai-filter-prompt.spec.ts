import {
  buildInstructions,
  buildRecordText,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-prompt';

describe('ai filter prompt', () => {
  it('sends only requested, non-empty fields', () => {
    expect(
      buildRecordText(
        { name: 'Acme', website: '', industry: 'Software', secret: 'x' },
        ['name', 'website', 'industry'],
      ),
    ).toBe('name: Acme\nindustry: Software');
  });

  it('puts criteria, context and the keep field in the instructions', () => {
    const text = buildInstructions({
      subject: 'person',
      criteria: 'VP or above in sales',
      context: 'Target locations: India',
      keepField: 'keep',
    });

    expect(text).toContain('VP or above in sales');
    expect(text).toContain('Target locations: India');
    expect(text).toContain('"keep"');
    expect(text).toContain('person');
  });

  it('omits the context section when there is none', () => {
    expect(
      buildInstructions({
        subject: 'company',
        criteria: 'c',
        keepField: 'fit',
      }),
    ).not.toContain('Campaign context');
  });
});

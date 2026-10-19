import {
  OUTREACH_DRAFT_DEFAULT_TEMPLATES,
  OUTREACH_DRAFT_TEMPLATE_KEYS,
  OUTREACH_DRAFT_VARIABLES,
  renderOutreachDraftTemplate,
  validateOutreachDraftTemplate,
  type OutreachDraftTemplateValues,
} from '../outreachDraftTemplates';

const SAMPLE_VALUES =
  OUTREACH_DRAFT_VARIABLES.reduce<OutreachDraftTemplateValues>(
    (values, variable) => ({ ...values, [variable.key]: variable.sampleValue }),
    {},
  );

describe('renderOutreachDraftTemplate', () => {
  it('should resolve every known variable when values are present', () => {
    const result = renderOutreachDraftTemplate(
      'Hi {{person.firstName}} at {{company.name}}',
      SAMPLE_VALUES,
    );

    expect(result.message).toBe('Hi Priya at Acme Retail');
    expect(result.missingVariableKeys).toEqual([]);
  });

  it('should report a missing variable when its value is blank', () => {
    const result = renderOutreachDraftTemplate('Hi {{person.firstName}}', {
      'person.firstName': '  ',
    });

    expect(result.missingVariableKeys).toEqual(['person.firstName']);
  });

  it('should report unknown variables', () => {
    const result = renderOutreachDraftTemplate('Hi {{person.nickname}}', {});

    expect(result.unknownVariableKeys).toEqual(['person.nickname']);
  });
});

describe('validateOutreachDraftTemplate', () => {
  it.each(OUTREACH_DRAFT_TEMPLATE_KEYS)(
    'should accept the default %s template with sample values',
    (templateKey) => {
      const validation = validateOutreachDraftTemplate({
        templateKey,
        template: OUTREACH_DRAFT_DEFAULT_TEMPLATES[templateKey],
        values: SAMPLE_VALUES,
      });

      expect(validation.errors).toEqual([]);
      expect(validation.isValid).toBe(true);
    },
  );

  it('should reject single-brace placeholders', () => {
    const validation = validateOutreachDraftTemplate({
      templateKey: 'firstMessage',
      template: 'Hi {Person First Name}',
      values: SAMPLE_VALUES,
    });

    expect(validation.isValid).toBe(false);
  });

  it('should reject a connection note longer than the LinkedIn limit', () => {
    const validation = validateOutreachDraftTemplate({
      templateKey: 'connectionNote',
      template: 'x'.repeat(301),
      values: SAMPLE_VALUES,
    });

    expect(validation.isValid).toBe(false);
  });
});

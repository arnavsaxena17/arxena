import {
  buildSourceCapabilities,
  matchIndustryLabels,
  parseRangeHint,
} from 'src/engine/core-modules/tool/tools/source-capabilities-tool/source-capabilities.util';

describe('source capabilities', () => {
  it('says revenue is not a Bright Data filter and offers the nearest field', () => {
    const capabilities = buildSourceCapabilities({
      sources: ['bright-data'],
      entity: 'company',
      want: ['annualRevenue', 'employees'],
    });

    expect(capabilities.searchable.map((field) => field.field)).toEqual(
      expect.arrayContaining(['employees', 'industry', 'keywords']),
    );

    const revenue = capabilities.notSearchable.find(
      (field) => field.field === 'annualRevenue',
    );

    expect(revenue?.nearest).toBe('employees');
    expect(revenue?.upgrade).toContain('Employee count');
    expect(revenue?.why).toContain('employee count, not revenue');
  });

  it('offers the revenue filter when Harvest is picked', () => {
    const capabilities = buildSourceCapabilities({
      sources: ['bright-data', 'harvest'],
      entity: 'company',
      want: ['annualRevenue'],
    });

    expect(capabilities.notSearchable).toEqual([]);
    expect(
      capabilities.searchable.find((field) => field.field === 'annualRevenue')
        ?.sources,
    ).toEqual(['harvest']);

    const revenueQuestion = capabilities.questions[0];

    expect(revenueQuestion.header).toBe('Revenue');
    expect(revenueQuestion.allowFreeText).toBe(true);
    expect(revenueQuestion.options.length).toBeGreaterThan(1);
  });

  it('builds the size question from the LinkedIn bands', () => {
    const capabilities = buildSourceCapabilities({
      sources: ['bright-data'],
      entity: 'company',
      want: ['employees'],
    });

    expect(capabilities.questions[0].header).toBe('Company size');
    expect(capabilities.questions[0].options).toEqual(
      expect.arrayContaining(['11-50', '51-200']),
    );
    expect(capabilities.questions[0].allowMultiSelect).toBe(true);
    expect(capabilities.questions[0].freeTextHint).toContain('₹');
  });

  it('maps a segment to the exact LinkedIn industry labels', () => {
    const capabilities = buildSourceCapabilities({
      sources: ['bright-data'],
      entity: 'company',
      want: ['industry'],
      term: 'retail stores',
    });

    const industryQuestion = capabilities.questions[0];

    expect(industryQuestion.header).toBe('Industry');
    expect(industryQuestion.options).toEqual(
      expect.arrayContaining(['Retail Apparel and Fashion']),
    );
    expect(industryQuestion.allowFreeText).toBe(true);
  });

  it('maps glass manufacturing to the exact LinkedIn label, not a merged row', () => {
    const labels = matchIndustryLabels('glass manufacturing', 5).map(
      (entry) => entry.label,
    );

    expect(labels[0]).toBe('Glass, Ceramics and Concrete Manufacturing');
    expect(labels.every((label) => label.length < 120)).toBe(true);
  });

  it('maps cement to the glass, ceramics and concrete label', () => {
    const labels = matchIndustryLabels('cement', 5).map((entry) => entry.label);

    expect(labels).toContain('Glass, Ceramics and Concrete Manufacturing');
  });

  it('reads the manufacturing spelling rule from the label list', () => {
    const labels = matchIndustryLabels('electrical equipment', 6).map(
      (entry) => entry.label,
    );

    expect(labels.some((label) => /Manufacturing$/.test(label))).toBe(true);
  });

  it('carries a Bright Data company URL into Harvest', () => {
    const capabilities = buildSourceCapabilities({
      sources: ['bright-data', 'harvest'],
      entity: 'company',
    });

    expect(capabilities.handoff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'bright-data',
          field: 'linkedinUrl',
          to: 'harvest',
          toField: 'currentCompanies',
        }),
      ]),
    );
  });

  it('keeps only the picked sources', () => {
    const capabilities = buildSourceCapabilities({
      sources: ['harvest'],
      entity: 'person',
    });

    expect(capabilities.sources).toEqual([
      { key: 'harvest', label: 'Harvest', entity: 'person' },
    ]);
    expect(
      capabilities.searchable.find((field) => field.field === 'currentCompany')
        ?.sources,
    ).toEqual(['harvest']);
  });

  it('reads a revenue figure out of the user words', () => {
    expect(
      parseRangeHint('COO for Rs 800 Cr auto components maker in Pune'),
    ).toEqual({
      min: 800,
      max: 800,
      unit: 'inr-crore',
    });
    expect(parseRangeHint('companies with 500 to 1000 employees')).toEqual({
      min: 500,
      max: 1000,
    });
    expect(parseRangeHint('retail chains')).toBeUndefined();
  });
});

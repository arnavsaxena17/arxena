import {
  normalizeLlmNullishString,
  OrgChartParsedSchema,
} from './org-chart.schema';

describe('normalizeLlmNullishString', () => {
  it('maps LLM null sentinels to null', () => {
    expect(normalizeLlmNullishString('/null')).toBeNull();
    expect(normalizeLlmNullishString('null')).toBeNull();
    expect(normalizeLlmNullishString('NULL')).toBeNull();
    expect(normalizeLlmNullishString('undefined')).toBeNull();
    expect(normalizeLlmNullishString('n/a')).toBeNull();
    expect(normalizeLlmNullishString('')).toBeNull();
    expect(normalizeLlmNullishString(null)).toBeNull();
  });

  it('preserves real values', () => {
    expect(normalizeLlmNullishString('India')).toBe('India');
    expect(normalizeLlmNullishString(' textile ')).toBe('textile');
  });
});

describe('OrgChartParsedSchema', () => {
  it('coerces /null strings to JSON null for optional fields', () => {
    const parsed = OrgChartParsedSchema.parse({
      business_division_keywords: 'textile OR textiles',
      country: '/null',
      business_division: '/null',
      role_description: '/null',
      std_grade_levels: null,
      function_root: null,
      rationale: '/null',
    });

    expect(parsed.country).toBeNull();
    expect(parsed.business_division).toBeNull();
    expect(parsed.role_description).toBeNull();
    expect(parsed.rationale).toBeNull();
  });
});

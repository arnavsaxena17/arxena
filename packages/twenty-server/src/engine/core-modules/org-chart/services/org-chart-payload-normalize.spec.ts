import { normalizeOrgChartPayload } from './org-chart-payload-normalize';

describe('normalizeOrgChartPayload', () => {
  it('parses stringified JSON fields into arrays and objects', () => {
    const input = {
      company_id: 'acme',
      orgchart: JSON.stringify([{ key: 1, headline: 'Sales' }]),
      countries: JSON.stringify(['united states', 'global']),
      functions: JSON.stringify(['sales', 'engineering']),
      country_analytics: JSON.stringify({ global: 100, 'united states': 50 }),
      gender_analytics: JSON.stringify({ male: 60, female: 40 }),
      location_analytics: JSON.stringify({ 'san francisco': 10 }),
    };

    const out = normalizeOrgChartPayload(input);

    expect(out.orgchart).toEqual([{ key: 1, headline: 'Sales' }]);
    expect(out.countries).toEqual(['united states', 'global']);
    expect(out.functions).toEqual(['sales', 'engineering']);
    expect(out.country_analytics).toEqual({ global: 100, 'united states': 50 });
    expect(out.gender_analytics).toEqual({ male: 60, female: 40 });
    expect(out.location_analytics).toEqual({ 'san francisco': 10 });
    expect(out.company_id).toBe('acme');
  });

  it('leaves already-parsed values unchanged', () => {
    const nested = { a: 1 };
    const input = {
      orgchart: [{ key: 1 }],
      countries: ['us'],
      country_analytics: nested,
    };

    const out = normalizeOrgChartPayload(input as Record<string, unknown>);

    expect(out.orgchart).toEqual([{ key: 1 }]);
    expect(out.countries).toEqual(['us']);
    expect(out.country_analytics).toBe(nested);
  });

  it('does not replace invalid JSON strings', () => {
    const input = {
      orgchart: 'not valid json{',
      country_analytics: '{broken',
    };

    const out = normalizeOrgChartPayload(input);

    expect(out.orgchart).toBe('not valid json{');
    expect(out.country_analytics).toBe('{broken');
  });

  it('normalizes stale org-chart function labels from ES payloads', () => {
    const input = {
      functions: JSON.stringify([
        'sales',
        'estate real',
        'marketing events',
      ]),
      functions_analytics: JSON.stringify({
        sales: 10,
        'estate real': 3,
        'marketing event': 2,
      }),
      orgchart: JSON.stringify([
        {
          key: 1,
          std_function: 'estate real',
          std_function_root: 'estate real',
          std_function_category: 'estate real',
          headline: 'REAL ESTATE LEADERSHIP',
        },
        {
          key: 2,
          std_function: 'marketing event',
          std_function_root: 'marketing',
          std_function_category: 'marketing',
          headline: 'MARKETING EVENT TEAM',
        },
      ]),
    };

    const out = normalizeOrgChartPayload(input);

    expect(out.functions).toEqual([
      'sales',
      'real estate',
      'event marketing',
    ]);
    expect(out.functions_analytics).toEqual({
      sales: 10,
      'real estate': 3,
      'event marketing': 2,
    });
    expect(out.orgchart).toEqual([
      {
        key: 1,
        std_function: 'real estate',
        std_function_root: 'real estate',
        std_function_category: 'real estate',
        headline: 'REAL ESTATE LEADERSHIP',
      },
      {
        key: 2,
        std_function: 'event marketing',
        std_function_root: 'marketing',
        std_function_category: 'marketing',
        headline: 'EVENT MARKETING TEAM',
      },
    ]);
  });
});

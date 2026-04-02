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
});

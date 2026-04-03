import { readFileSync } from 'fs';
import * as path from 'path';

import {
    applyBlankOrgChartSubsetFilter,
    isBlankSubsetRequest,
} from './blank-org-chart-subset.util';

describe('blank-org-chart-subset.util', () => {
  const blankPath = path.join(
    __dirname,
    '..',
    'static',
    'blank_org_chart_emp_obj.json',
  );

  it('isBlankSubsetRequest is false for global fullcompany', () => {
    expect(isBlankSubsetRequest({ country: 'global', functionRoot: '' })).toBe(
      false,
    );
    expect(
      isBlankSubsetRequest({ country: 'global', functionRoot: 'fullcompany' }),
    ).toBe(false);
  });

  it('isBlankSubsetRequest is true for country or function subset', () => {
    expect(isBlankSubsetRequest({ country: 'India', functionRoot: '' })).toBe(
      true,
    );
    expect(
      isBlankSubsetRequest({ country: 'global', functionRoot: 'engineering' }),
    ).toBe(true);
  });

  it('applyBlankOrgChartSubsetFilter trims engineering to fewer nodes than full blank', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const full = JSON.parse(parsed.orgchart as string) as unknown[];
    const filtered = applyBlankOrgChartSubsetFilter(parsed, {
      country: 'global',
      functionRoot: 'engineering',
    });
    const next = JSON.parse(filtered.orgchart as string) as unknown[];
    console.log(
      `blank subset engineering: full=${full.length} filtered=${next.length}`,
    );
    expect(next.length).toBeGreaterThan(0);
    expect(next.length).toBeLessThan(full.length);
  });

  it('applyBlankOrgChartSubsetFilter country-only BFS is smaller than full blank', () => {
    const raw = readFileSync(blankPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const full = JSON.parse(parsed.orgchart as string) as unknown[];
    const filtered = applyBlankOrgChartSubsetFilter(parsed, {
      country: 'Germany',
      functionRoot: 'fullcompany',
    });
    const next = JSON.parse(filtered.orgchart as string) as unknown[];
    const first = next[0] as { candidates?: { location_country?: string }[] };
    console.log(
      `blank subset country-only: full=${full.length} filtered=${next.length}`,
    );
    expect(next.length).toBeLessThanOrEqual(72);
    expect(next.length).toBeLessThan(full.length);
    expect(first.candidates?.[0]?.location_country).toBe('Germany');
  });
});

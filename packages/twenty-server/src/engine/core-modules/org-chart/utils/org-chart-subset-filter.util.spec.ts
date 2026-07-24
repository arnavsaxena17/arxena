import {
    applyOrgChartPayloadSubsetFilter,
    isOrgChartPayloadSubsetRequest,
} from './org-chart-subset-filter.util';

describe('org-chart-subset-filter.util', () => {
  const basePayload = {
    company_id: 'contactout',
    type: 'fullcompany',
    country: 'global',
    orgchart: JSON.stringify([
      {
        key: 1,
        parent: '',
        headline: 'CEO',
        std_function_root: 'technology',
        candidates: [{ full_name: 'Alice', location_country: 'United States' }],
        len_candidates: 1,
      },
      {
        key: 2,
        parent: 1,
        headline: 'Engineering Lead',
        std_function_root: 'technology',
        candidates: [{ full_name: 'Bob', location_country: 'India' }],
        len_candidates: 1,
      },
      {
        key: 3,
        parent: 1,
        headline: 'Sales Lead',
        std_function_root: 'sales',
        candidates: [{ full_name: 'Carol', location_country: 'United States' }],
        len_candidates: 1,
      },
    ]),
  };

  it('detects subset requests', () => {
    console.log('isOrgChartPayloadSubsetRequest: global/fullcompany');
    expect(isOrgChartPayloadSubsetRequest({})).toBe(false);
    expect(
      isOrgChartPayloadSubsetRequest({
        country: 'global',
        functionRoot: 'fullcompany',
      }),
    ).toBe(false);
    expect(
      isOrgChartPayloadSubsetRequest({ functionRoot: 'engineering' }),
    ).toBe(true);
    expect(isOrgChartPayloadSubsetRequest({ country: 'India' })).toBe(true);
  });

  it('filters full-company payload by function root', () => {
    console.log('applyOrgChartPayloadSubsetFilter: technology subset');
    const filtered = applyOrgChartPayloadSubsetFilter(basePayload, {
      functionRoot: 'technology',
    });
    const nodes = JSON.parse(String(filtered.orgchart)) as Array<{ key: number }>;
    console.log(
      `technology subset keys=${nodes.map((node) => node.key).join(',')}`,
    );
    expect(filtered.type).toBe('technology');
    expect(nodes.map((node) => node.key).sort()).toEqual([1, 2]);
  });

  it('filters full-company payload by country', () => {
    console.log('applyOrgChartPayloadSubsetFilter: India subset');
    const filtered = applyOrgChartPayloadSubsetFilter(basePayload, {
      country: 'India',
    });
    const nodes = JSON.parse(String(filtered.orgchart)) as Array<{ key: number }>;
    console.log(`India subset keys=${nodes.map((node) => node.key).join(',')}`);
    expect(filtered.country).toBe('India');
    expect(nodes.map((node) => node.key).sort()).toEqual([1, 2]);
  });

  it('returns payload unchanged when no subset filters apply', () => {
    console.log('applyOrgChartPayloadSubsetFilter: no-op');
    const filtered = applyOrgChartPayloadSubsetFilter(basePayload, {
      country: 'global',
      functionRoot: 'fullcompany',
    });
    expect(filtered).toBe(basePayload);
  });
});

import {
  planEnrichment,
  SOURCING_ENRICH_COST_USD,
} from 'src/domains/ingestion/candidate-sourcing/run/enrich.util';
import {
  needsSplit,
  planCandidates,
  specFor,
  splitCandidate,
} from 'src/domains/ingestion/candidate-sourcing/run/plan.util';
import {
  type JudgedRow,
  type PlannedQuery,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';

const QUERY: PlannedQuery = {
  label: 'CFO in Mumbai',
  keywords: 'finance OR treasury',
  jobTitle: 'CFO',
  companies: ['Tata Steel'],
  locations: ['Mumbai'],
};

describe('specFor', () => {
  it('should say the same query in each of the three kinds', () => {
    expect(specFor('facets', QUERY)).toEqual({
      kind: 'facets',
      filters: {
        jobTitle: 'CFO',
        companies: ['Tata Steel'],
        locations: ['Mumbai'],
        keywords: 'finance OR treasury',
      },
    });
    expect(specFor('boolean', QUERY)).toEqual({
      kind: 'boolean',
      query: 'finance OR treasury',
      facets: {
        jobTitle: 'CFO',
        companies: ['Tata Steel'],
        locations: ['Mumbai'],
      },
    });
    expect(specFor('string', QUERY)).toEqual({
      kind: 'string',
      query: 'CFO finance OR treasury "Tata Steel" Mumbai',
    });
  });
});

describe('planCandidates', () => {
  it('should make one candidate per source and query, priced from the registry', () => {
    const { candidates, unusable } = planCandidates({
      queries: [QUERY, { ...QUERY, label: 'Finance head' }],
      sources: ['harvest', 'index'],
    });

    expect(unusable).toEqual([]);
    expect(
      candidates.map(({ id, source, label, costPerPageUsd, spec }) => ({
        id,
        source,
        label,
        costPerPageUsd,
        kind: spec.kind,
      })),
    ).toEqual([
      {
        id: 'c1',
        source: 'harvest',
        label: 'CFO in Mumbai',
        costPerPageUsd: 0.1,
        kind: 'boolean',
      },
      {
        id: 'c2',
        source: 'harvest',
        label: 'Finance head',
        costPerPageUsd: 0.1,
        kind: 'boolean',
      },
      {
        id: 'c3',
        source: 'index',
        label: 'CFO in Mumbai',
        costPerPageUsd: 0,
        kind: 'facets',
      },
      {
        id: 'c4',
        source: 'index',
        label: 'Finance head',
        costPerPageUsd: 0,
        kind: 'facets',
      },
    ]);
  });

  it('should refuse a source with no price rather than treat it as free', () => {
    expect(
      planCandidates({ queries: [QUERY], sources: ['apollo', 'unipile'] }),
    ).toEqual({
      candidates: [],
      unusable: [
        { source: 'apollo', reason: 'no price is recorded for it' },
        { source: 'unipile', reason: 'not a source the loop knows' },
      ],
    });
  });

  it('should report a source that cannot run the spec, once', () => {
    expect(
      planCandidates({
        queries: [QUERY, { ...QUERY, label: 'Finance head' }],
        sources: ['harvest', 'index'],
        rejects: (source) =>
          source === 'harvest' ? 'it cannot filter by company name' : undefined,
      }),
    ).toMatchObject({
      candidates: [{ source: 'index' }, { source: 'index' }],
      unusable: [
        { source: 'harvest', reason: 'it cannot filter by company name' },
      ],
    });
  });

  it('should carry the search type only on a LinkedIn account source', () => {
    const { candidates } = planCandidates({
      queries: [QUERY],
      sources: ['linkedin', 'index'],
      searchType: 'sales_navigator',
    });

    expect(candidates.map((candidate) => candidate.searchType)).toEqual([
      'sales_navigator',
      undefined,
    ]);
  });
});

describe('splitCandidate', () => {
  it('should split only a candidate above the source ceiling', () => {
    const [candidate] = planCandidates({
      queries: [QUERY],
      sources: ['linkedin'],
    }).candidates;

    expect(needsSplit({ ...candidate, available: 2400 }, 2500)).toBe(false);
    expect(needsSplit({ ...candidate, available: null }, 2500)).toBe(false);
    expect(needsSplit({ ...candidate, available: 9000 }, undefined)).toBe(
      false,
    );
    expect(needsSplit({ ...candidate, available: 9000 }, 2500)).toBe(true);

    const parts = splitCandidate({ ...candidate, fetched: 25, pages: 1 }, [
      { kind: 'boolean', query: 'cfo', facets: { region: 'north' } },
      { kind: 'boolean', query: 'cfo', facets: { region: 'south' } },
    ]);

    expect(
      parts.map(({ id, label, pages, fetched, live }) => ({
        id,
        label,
        pages,
        fetched,
        live,
      })),
    ).toEqual([
      {
        id: 'c1.1',
        label: 'CFO in Mumbai (1/2)',
        pages: 0,
        fetched: 0,
        live: true,
      },
      {
        id: 'c1.2',
        label: 'CFO in Mumbai (2/2)',
        pages: 0,
        fetched: 0,
        live: true,
      },
    ]);
  });
});

describe('planEnrichment', () => {
  const judged = (
    rowId: string,
    outcome: JudgedRow['outcome'],
    enrich: JudgedRow['enrich'] = [],
  ): JudgedRow => ({ rowId, outcome, enrich });

  it('should queue only undecided rows, at their cheapest level', () => {
    const plan = planEnrichment({
      rows: [
        judged('a', 'unknown', ['profile', 'company_web']),
        judged('b', 'unknown', ['company_web']),
        judged('c', 'fail', ['profile']),
        judged('d', 'qualified'),
        judged('e', 'to_confirm'),
        judged('f', 'unknown', []),
      ],
      budgetUsd: 1,
    });

    expect(plan).toEqual({
      steps: [
        { level: 'profile', rowIds: ['a'], costUsd: 0.02 },
        { level: 'company_web', rowIds: ['b'], costUsd: 0.03 },
      ],
      costUsd: 0.05,
      unfunded: 0,
    });
  });

  it('should stop at the budget and say how many rows it left', () => {
    const plan = planEnrichment({
      rows: ['a', 'b', 'c', 'd'].map((id) =>
        judged(id, 'unknown', ['profile']),
      ),
      budgetUsd: SOURCING_ENRICH_COST_USD.profile * 3,
    });

    expect(plan.steps).toEqual([
      { level: 'profile', rowIds: ['a', 'b', 'c'], costUsd: 0.06 },
    ]);
    expect(plan.unfunded).toBe(1);
  });

  it('should plan nothing with no budget', () => {
    expect(
      planEnrichment({
        rows: [judged('a', 'unknown', ['profile'])],
        budgetUsd: 0,
      }),
    ).toEqual({ steps: [], costUsd: 0, unfunded: 1 });
  });
});

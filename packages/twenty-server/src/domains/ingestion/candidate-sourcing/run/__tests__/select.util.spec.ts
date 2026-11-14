import {
  SOURCING_SELECT_MAX_PAGES_PER_CANDIDATE,
  selectCandidates,
  type SelectCandidate,
} from 'src/domains/ingestion/candidate-sourcing/run/select.util';

const candidate = (
  overrides: Partial<SelectCandidate> & { id: string },
): SelectCandidate => ({
  costPerPageUsd: 0.1,
  pageSize: 25,
  available: 500,
  fetched: 25,
  newUnique: 25,
  ...overrides,
});

describe('selectCandidates', () => {
  it('should rank by expected qualified rows per dollar', () => {
    const selected = selectCandidates({
      candidates: [
        candidate({ id: 'mostly-duplicates', newUnique: 5 }),
        candidate({ id: 'fresh' }),
      ],
      budgetUsd: 10,
      need: null,
    });

    expect(selected.map((entry) => entry.id)).toEqual([
      'fresh',
      'mostly-duplicates',
    ]);
    expect(selected[0].qualifiedPerUsd).toBe(250);
  });

  it('should put a free source first', () => {
    const selected = selectCandidates({
      candidates: [
        candidate({ id: 'paid' }),
        candidate({ id: 'free', costPerPageUsd: 0, newUnique: 10 }),
      ],
      budgetUsd: 10,
      need: null,
    });

    expect(selected[0]).toMatchObject({
      id: 'free',
      budgetUsd: 0,
      qualifiedPerUsd: null,
    });
  });

  it('should stop allocating once the need is covered', () => {
    const selected = selectCandidates({
      candidates: [candidate({ id: 'first' }), candidate({ id: 'second' })],
      budgetUsd: 10,
      need: 40,
    });

    expect(selected).toEqual([
      {
        id: 'first',
        pages: 2,
        budgetUsd: 0.2,
        expectedQualified: 50,
        qualifiedPerUsd: 250,
      },
    ]);
  });

  it('should never allocate more than the budget', () => {
    const selected = selectCandidates({
      candidates: [candidate({ id: 'first' }), candidate({ id: 'second' })],
      budgetUsd: 0.35,
      need: null,
    });

    expect(selected).toEqual([
      expect.objectContaining({ id: 'first', pages: 3, budgetUsd: 0.3 }),
    ]);
  });

  it('should cap pages at what the source says is left', () => {
    const selected = selectCandidates({
      candidates: [candidate({ id: 'small', available: 60 })],
      budgetUsd: 10,
      need: null,
    });

    expect(selected[0].pages).toBe(2);
  });

  it('should cap a candidate whose count cannot be trusted', () => {
    const selected = selectCandidates({
      candidates: [
        candidate({ id: 'classic', available: null, costPerPageUsd: 0 }),
      ],
      budgetUsd: 0,
      need: null,
    });

    expect(selected[0].pages).toBe(SOURCING_SELECT_MAX_PAGES_PER_CANDIDATE);
  });

  it('should drop a candidate whose probe returned nothing new', () => {
    expect(
      selectCandidates({
        candidates: [
          candidate({ id: 'empty', fetched: 0, newUnique: 0 }),
          candidate({ id: 'known', newUnique: 0 }),
          candidate({ id: 'used-up', available: 25 }),
        ],
        budgetUsd: 10,
        need: null,
      }),
    ).toEqual([]);
  });

  it('should use judged results, and their pooled rate for the unjudged', () => {
    const selected = selectCandidates({
      candidates: [
        candidate({ id: 'judged-poor', judged: 20, qualified: 2 }),
        candidate({ id: 'judged-good', judged: 20, qualified: 10 }),
        candidate({ id: 'unjudged' }),
      ],
      budgetUsd: 10,
      need: null,
    });

    expect(selected.map((entry) => entry.id)).toEqual([
      'judged-good',
      'unjudged',
      'judged-poor',
    ]);
  });

  it('should respect maxCandidates', () => {
    expect(
      selectCandidates({
        candidates: [candidate({ id: 'a' }), candidate({ id: 'b' })],
        budgetUsd: 10,
        need: null,
        maxCandidates: 1,
      }),
    ).toHaveLength(1);
  });
});

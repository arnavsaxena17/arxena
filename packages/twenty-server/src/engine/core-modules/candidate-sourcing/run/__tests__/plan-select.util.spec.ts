import {
  buildSearchQuery,
  estimateProbeCostUsd,
  planCandidates,
  unplannedSources,
} from 'src/engine/core-modules/candidate-sourcing/run/plan.util';
import {
  rankCandidates,
  splitBudget,
} from 'src/engine/core-modules/candidate-sourcing/run/select.util';
import { type SourcingCandidate } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.types';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

const spec = (overrides: Partial<SourcingSpec> = {}): SourcingSpec => ({
  hard: [
    { field: 'title', userWords: 'Plant head', normalized: ['plant head'] },
    { field: 'location', userWords: 'Gujarat', normalized: ['gujarat'] },
  ],
  soft: [],
  exclusions: [],
  normalized: { titles: ['plant head'], industries: [] },
  target: { count: 30 },
  coverage: 'best_effort',
  ...overrides,
});

const candidate = (
  id: string,
  probe?: SourcingCandidate['probe'],
  exhausted = false,
): SourcingCandidate => ({
  id,
  source: 'internal-index',
  adapter: 'people_index',
  query: 'q',
  fetched: 0,
  newRows: 0,
  qualified: 0,
  spentUsd: 0,
  exhausted,
  probe,
});

describe('planCandidates', () => {
  it('should plan the free index then Bright Data by default', () => {
    const planned = planCandidates({
      spec: spec(),
      request: 'Plant heads in Gujarat chemical companies',
    });

    expect(planned.map((item) => [item.adapter, item.query])).toEqual([
      ['people_index', 'Plant head Gujarat'],
      ['bright_data_people', 'Plant heads in Gujarat chemical companies'],
    ]);
  });

  it('should make named employers one people_by_company round', () => {
    const planned = planCandidates({
      spec: spec({
        hard: [
          { field: 'title', userWords: 'CFO', normalized: ['cfo'] },
          { field: 'company', userWords: 'Zomato', normalized: ['zomato'] },
          { field: 'company', userWords: 'Swiggy', normalized: ['swiggy'] },
        ],
      }),
      request: 'CFOs at Zomato and Swiggy',
    });

    expect(planned).toHaveLength(1);
    expect(planned[0]).toEqual(
      expect.objectContaining({
        adapter: 'people_by_company',
        query: 'Zomato | Swiggy',
      }),
    );
    expect(
      estimateProbeCostUsd(
        planned,
        spec({
          hard: [
            { field: 'company', userWords: 'Zomato', normalized: ['zomato'] },
            { field: 'company', userWords: 'Swiggy', normalized: ['swiggy'] },
          ],
        }),
      ),
    ).toBeCloseTo(0.2);
  });

  it('should keep only picked sources it can search, and name the rest', () => {
    const planned = planCandidates({
      spec: spec(),
      request: 'x',
      sources: ['linkedin', 'internal-index'],
    });

    expect(planned.map((item) => item.source)).toEqual(['internal-index']);
    expect(unplannedSources(['linkedin', 'internal-index'])).toEqual([
      'linkedin',
    ]);
    expect(buildSearchQuery(spec({ hard: [] }))).toBe('');
  });
});

describe('select', () => {
  it('should rank live candidates by qualified per dollar', () => {
    const ranked = rankCandidates([
      candidate('paid', {
        fetched: 25,
        newRows: 25,
        qualified: 10,
        costUsd: 0.5,
      }),
      candidate('free', { fetched: 25, newRows: 25, qualified: 3, costUsd: 0 }),
      candidate(
        'dead',
        { fetched: 0, newRows: 0, qualified: 0, costUsd: 0 },
        true,
      ),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(['free', 'paid']);
  });

  it('should split the budget by yield with a floor for each funded candidate', () => {
    const shares = splitBudget(10, [
      candidate('a', { fetched: 1, newRows: 0, qualified: 9, costUsd: 1 }),
      candidate('b', { fetched: 1, newRows: 0, qualified: 1, costUsd: 1 }),
      candidate('c', { fetched: 1, newRows: 0, qualified: 1, costUsd: 1 }),
    ]);

    expect([...shares.keys()]).toEqual(['a', 'b']);
    expect(shares.get('a')).toBeCloseTo(0.5 + 9 * 0.9);
    expect(shares.get('b')).toBeCloseTo(0.5 + 0.9);
    expect(splitBudget(0, [candidate('a')]).size).toBe(0);
  });
});

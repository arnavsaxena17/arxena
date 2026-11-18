import {
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
  source: 'bright-data',
  adapter: 'bright_data_people',
  query: 'q',
  fetched: 0,
  newRows: 0,
  qualified: 0,
  spentUsd: 0,
  exhausted,
  probe,
});

describe('planCandidates', () => {
  it('should plan Bright Data on its own, one candidate per query variant', () => {
    const planned = planCandidates({
      spec: spec({ budgetUsd: 2 }),
      request: 'Plant heads in Gujarat chemical companies',
    });

    expect(planned.map((item) => [item.source, item.adapter, item.query])).toEqual(
      [
        [
          'bright-data',
          'bright_data_people',
          'Plant heads in Gujarat chemical companies',
        ],
        ['bright-data', 'bright_data_people', 'plant head Gujarat'],
      ],
    );
    // Two probes the budget covers are two guesses, not two prices
    expect(estimateProbeCostUsd(planned, spec({ budgetUsd: 2 }))).toBeCloseTo(
      1,
    );
  });

  it('should plan as many variants as the budget covers', () => {
    const narrow = planCandidates({
      spec: spec({ budgetUsd: 0.3 }),
      request: 'Plant heads in Gujarat chemical companies',
    });
    const wide = planCandidates({
      spec: spec({ budgetUsd: 50 }),
      request: 'Plant heads in Gujarat chemical companies',
    });

    expect(narrow).toHaveLength(1);
    expect(wide.length).toBeGreaterThan(narrow.length);
    expect(wide.length).toBeLessThanOrEqual(3);
  });

  it('should order variants by precision: request, employer-focused, broad', () => {
    const planned = planCandidates({
      spec: spec({
        budgetUsd: 50,
        hard: [
          { field: 'title', userWords: 'Sales Rep', normalized: ['sales rep'] },
          { field: 'location', userWords: 'Mumbai', normalized: ['mumbai'] },
          {
            field: 'company_type',
            userWords: 'oncology pharma',
            normalized: ['oncology pharma'],
          },
        ],
        normalized: { titles: ['sales rep'], industries: [] },
      }),
      request: 'sales reps at oncology pharma companies in Mumbai',
    });

    expect(planned.map((item) => item.query)).toEqual([
      'sales reps at oncology pharma companies in Mumbai',
      'sales rep oncology pharma Mumbai',
      'sales rep Mumbai',
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
      spec: spec({ budgetUsd: 0.3 }),
      request: 'x',
      sources: ['linkedin', 'bright-data'],
    });

    expect(planned.map((item) => item.source)).toEqual(['bright-data']);
    expect(unplannedSources(['linkedin', 'internal-index'])).toEqual([
      'linkedin',
      'internal-index',
    ]);
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

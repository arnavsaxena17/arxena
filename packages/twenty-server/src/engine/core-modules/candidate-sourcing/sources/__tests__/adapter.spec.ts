import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import {
  defineSourceAdapter,
  splitConstraintsForSource,
  toSourcingSourceError,
} from 'src/engine/core-modules/candidate-sourcing/sources/adapter';
import {
  type SourcingConstraint,
  type SourcingSpec,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

const constraint = (
  field: SourcingConstraint['field'],
  userWords: string,
): SourcingConstraint => ({
  field,
  userWords,
  normalized: [userWords.toLowerCase()],
});

const spec: SourcingSpec = {
  hard: [
    constraint('title', 'CFO'),
    constraint('location', 'Pune'),
    constraint('experience_years', '15+ years'),
    constraint('company_type', 'listed'),
  ],
  soft: [constraint('skill', 'SAP')],
  exclusions: [constraint('company', 'Tata Motors')],
  normalized: { titles: ['cfo'], industries: [] },
  target: { count: 20 },
  coverage: 'best_effort',
};

describe('splitConstraintsForSource', () => {
  it('should hand on what a source cannot filter, and every exclusion', () => {
    const split = splitConstraintsForSource(spec, 'linkedin', ['boolean']);

    expect(split.expressed.map((item) => item.field)).toEqual([
      'title',
      'location',
    ]);
    expect(split.postFilters.map((item) => item.field)).toEqual([
      'experience_years',
      'company_type',
      'company',
    ]);
  });

  it('should use the per-source capability matrix', () => {
    const split = splitConstraintsForSource(spec, 'naukri', []);

    expect(split.expressed.map((item) => item.field)).toEqual([
      'title',
      'location',
      'experience_years',
    ]);
  });

  it('should let a query-text source carry keywords', () => {
    const withKeyword = {
      ...spec,
      hard: [constraint('keyword', 'cold chain')],
    };

    expect(
      splitConstraintsForSource(withKeyword, 'serp', ['string']).expressed,
    ).toHaveLength(1);
    expect(
      splitConstraintsForSource(withKeyword, 'apollo', ['facets']).postFilters,
    ).toHaveLength(2);
  });
});

describe('toSourcingSourceError', () => {
  it.each([
    [
      new AccountRateLimitDeferredError({
        waitMs: 1000,
        accountId: 'a',
        method: 'search',
      }),
      'deferred',
    ],
    [{ response: { status: 429 } }, 'rate_limited'],
    [{ status: 401 }, 'unconfigured'],
    [new Error('EXA_API_KEY missing'), 'unconfigured'],
    [new Error('Apollo API key not set'), 'unconfigured'],
    [new Error('NOT_IMPLEMENTED: pdl search'), 'unconfigured'],
    [new Error('Run budget reached'), 'budget'],
    [new Error('No results for query'), 'no_results'],
    [{ response: { status: 502 } }, 'upstream'],
  ])('should map %p to %s', (error, expected) => {
    expect(toSourcingSourceError(error)).toBe(expected);
  });
});

describe('defineSourceAdapter', () => {
  it('should return rows with post-filters, and an error enum on throw', async () => {
    const search = jest
      .fn()
      .mockResolvedValueOnce({ rows: [], costUsd: 0.01, counts: 40 })
      .mockRejectedValueOnce({ response: { status: 429 } });
    const adapter = defineSourceAdapter({
      key: 'harvest',
      acceptedKinds: ['boolean'],
      search,
    });
    const searchSpec = { kind: 'boolean' as const, query: 'CFO', facets: {} };

    const ok = await adapter.search(searchSpec, spec);
    const failed = await adapter.search(searchSpec, spec);

    expect(ok).toEqual(expect.objectContaining({ costUsd: 0.01, counts: 40 }));
    expect(ok.postFilters.map((item) => item.field)).toContain('company');
    expect(failed).toEqual(
      expect.objectContaining({ costUsd: 0, error: 'rate_limited' }),
    );
  });

  it('should refuse a spec kind the source does not accept', async () => {
    const adapter = defineSourceAdapter({
      key: 'serp',
      acceptedKinds: ['string'],
      search: jest.fn(),
    });

    await expect(
      adapter.search({ kind: 'facets', filters: {} }, spec),
    ).rejects.toThrow(/does not accept a facets spec/);
  });
});

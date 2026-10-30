import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { type FindPeoplePairState } from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import {
  computePairFunnel,
  computeSourcingFrontier,
  computeSourcingFunnel,
  mergeSourcingBrief,
  normalizeSourcingBriefDraft,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';

const profile = (source: 'bright_data' | 'harvest') => ({
  source,
  fetchedAt: '2026-10-19T00:00:00.000Z',
  fieldsPresent: ['about'],
});

const row = (
  id: string,
  linkedinUrl: string | undefined,
  otherFields: Record<string, unknown> = {},
): OutreachTabRow => ({
  id,
  source: 'ephemeral',
  name: id,
  linkedinUrl,
  otherFields,
});

describe('computeSourcingFunnel', () => {
  it('should count only people who passed on a full profile as qualified', () => {
    const funnel = computeSourcingFunnel([
      row('a', 'u1', {
        fitmentOutcome: 'pass',
        profile: profile('bright_data'),
      }),
      row('b', 'u2', { fitmentOutcome: 'pass' }),
      row('c', 'u3', { fitmentOutcome: 'unknown' }),
      row('d', 'u4', { fitmentOutcome: 'fail', profile: profile('harvest') }),
      row('e', undefined, { fitmentOutcome: 'pass' }),
      row('f', 'u6'),
    ]);

    expect(funnel).toMatchObject({
      rows: 6,
      withLinkedinUrl: 5,
      withoutLinkedinUrl: 1,
      withProfile: { brightData: 1, harvest: 1 },
      notScored: 1,
      outcomes: { pass: 3, unknown: 1, fail: 1 },
      qualified: 1,
    });
  });

  it('should count people who still need a profile fetch', () => {
    const funnel = computeSourcingFunnel([
      row('a', 'u1', { fitmentOutcome: 'pass' }),
      row('b', 'u2', { fitmentOutcome: 'unknown' }),
      row('c', 'u3', { fitmentOutcome: 'fail' }),
      row('d', undefined, { fitmentOutcome: 'pass' }),
    ]);

    // pass and unknown with a URL and no profile; a failed row or one with no
    // URL cannot be fetched
    expect(funnel.awaitingProfile).toBe(2);
  });

  it('should read the snake-case key that CRM-backed rows carry', () => {
    const funnel = computeSourcingFunnel([
      row('a', 'u1', {
        fitment_outcome: 'pass',
        profile: profile('harvest'),
      }),
    ]);

    expect(funnel.qualified).toBe(1);
  });
});

const pair = (
  overrides: Partial<FindPeoplePairState>,
): FindPeoplePairState => ({
  roles: ['CEO'],
  terminalState: 'found',
  sourcesUsed: ['bright_data'],
  titlesTried: ['CEO'],
  costUsd: 0.02,
  attempts: 1,
  personKeys: ['u1'],
  updatedAt: 't',
  ...overrides,
});

const company = (id: string, pairs: FindPeoplePairState[]): OutreachTabRow =>
  row(id, undefined, {
    findPeoplePairs: Object.fromEntries(
      pairs.map((item) => [item.roles.join('+').toLowerCase(), item]),
    ),
  });

describe('computePairFunnel', () => {
  it('should count pairs by state, rung and source and write the coverage line', () => {
    const funnel = computePairFunnel([
      company('a', [pair({ rungUsed: 1 })]),
      company('b', [
        pair({ rungUsed: 3, sourcesUsed: ['bright_data', 'google'] }),
      ]),
      company('c', [
        pair({
          terminalState: 'none_found',
          reason: 'no_such_role',
          personKeys: [],
          costUsd: 0.1,
        }),
      ]),
      company('d', [
        pair({ terminalState: 'ambiguous', personKeys: ['x', 'y'] }),
      ]),
      row('e', undefined),
    ]);

    expect(funnel.pairs).toBe(4);
    expect(funnel.byState).toMatchObject({
      found: 2,
      none_found: 1,
      ambiguous: 1,
    });
    expect(funnel.byRung).toEqual({ rung1: 1, rung3: 1 });
    expect(funnel.bySource).toEqual({ bright_data: 4, google: 1 });
    expect(funnel.notLookedUp).toBe(1);
    expect(funnel.topReasons).toContainEqual({
      reason: 'none_found: no_such_role',
      count: 1,
    });
    expect(funnel.resolutionRate).toBe(0.5);
    expect(funnel.coverageLine).toBe(
      '2 of 4 covered; 1 none found (reasons attached); 1 need your review; 1 companies not looked up yet.',
    );
  });

  it('should report no pairs for companies never looked up', () => {
    const funnel = computePairFunnel([row('a', undefined)]);

    expect(funnel.pairs).toBe(0);
    expect(funnel.costPerFoundUsd).toBeNull();
  });
});

describe('mergeSourcingBrief', () => {
  it('should keep earlier fields and raise the version when a later brief adds sources', () => {
    const first = mergeSourcingBrief(undefined, {
      requestType: 'named_role',
      target: null,
      who: 'head of e-commerce at the uploaded companies',
      criteria: [],
      assumptions: [],
      capsUsd: { fetch: 5 },
    });
    const second = mergeSourcingBrief(first, {
      sources: ['bright-data', 'serp'],
      capsUsd: { perPair: 0.1 },
    });

    expect(second.who).toBe('head of e-commerce at the uploaded companies');
    expect(second.sources).toEqual(['bright-data', 'serp']);
    expect(second.capsUsd).toEqual({ fetch: 5, perPair: 0.1 });
    expect(second.version).toBe(2);
  });

  it('should not add empty caps or thresholds', () => {
    const brief = mergeSourcingBrief(undefined, { who: 'x' });

    expect(brief).not.toHaveProperty('capsUsd');
    expect(brief).not.toHaveProperty('thresholds');
  });

  it('should keep the coverage intent and replace the query plan', () => {
    const first = mergeSourcingBrief(undefined, {
      who: 'plant heads in Gujarat',
      coverage: 'exhaustive',
      universe: { kind: 'project', count: 443 },
      queries: [{ source: 'bright-data', query: 'plant head' }],
      capsUsd: { run: 40 },
    });
    const second = mergeSourcingBrief(first, {
      queries: [{ source: 'serp', query: 'works manager' }],
      universe: { note: 'after the list freeze' },
    });

    expect(second.coverage).toBe('exhaustive');
    expect(second.capsUsd?.run).toBe(40);
    expect(second.universe).toEqual({
      kind: 'project',
      count: 443,
      note: 'after the list freeze',
    });
    expect(second.queries).toEqual([
      { source: 'serp', query: 'works manager' },
    ]);
  });
});

describe('normalizeSourcingBriefDraft', () => {
  it('turns a prose brief into briefText', () => {
    const draft = normalizeSourcingBriefDraft(
      'VP Engineering at fintech startups in Bangalore',
    );

    expect(draft?.briefText).toBe(
      'VP Engineering at fintech startups in Bangalore',
    );
    expect(draft?.who).toContain('VP Engineering');
    expect(draft?.requestType).toBe('named_role');
  });

  it('accepts one role as a string, persona aliases and a single source', () => {
    const draft = normalizeSourcingBriefDraft({
      roles: 'VP Engineering, Head of Engineering',
      persona: 'sales_prospect',
      sources: 'bright-data',
      requestType: 'role_at_companies',
    });

    expect(draft?.roles).toEqual(['VP Engineering', 'Head of Engineering']);
    expect(draft?.persona).toBe('sales');
    expect(draft?.sources).toEqual(['bright-data']);
    expect(draft?.requestType).toBe('named_role');
  });

  it('maps a role plus industry and country to company_list', () => {
    const draft = normalizeSourcingBriefDraft({
      requestType: 'role-plus-industry-country',
    });

    expect(draft?.requestType).toBe('company_list');
  });

  it('normalizes a criteria object and a prose assumptions line', () => {
    const draft = normalizeSourcingBriefDraft({
      criteria: { company: 'glass manufacturer, not a trader' },
      assumptions: 'all glass segments; any size',
    });

    expect(draft?.criteria).toEqual([
      {
        description: 'company: glass manufacturer, not a trader',
        mustHave: true,
      },
    ]);
    expect(draft?.assumptions).toEqual(['all glass segments; any size']);
  });

  it('ignores a value that is not a brief', () => {
    expect(normalizeSourcingBriefDraft('')).toBeUndefined();
    expect(normalizeSourcingBriefDraft(null)).toBeUndefined();
    expect(normalizeSourcingBriefDraft(42)).toBeUndefined();
  });

  it('keeps a valid object as it is', () => {
    const draft = normalizeSourcingBriefDraft({
      persona: 'exec_search',
      requestType: 'named_role',
      target: 40,
    });

    expect(draft).toMatchObject({
      persona: 'exec_search',
      requestType: 'named_role',
      target: 40,
    });
  });

  it('normalises the coverage aliases and a run cap written as a string', () => {
    const exhaustive = normalizeSourcingBriefDraft({
      coverage: 'MECE',
      capsUsd: { run: '25', perPair: '0.1' },
    });
    const bestEffort = normalizeSourcingBriefDraft({ coverage: 'best-effort' });

    expect(exhaustive?.coverage).toBe('exhaustive');
    expect(exhaustive?.capsUsd).toEqual({ run: 25, perPair: 0.1 });
    expect(bestEffort?.coverage).toBe('best_effort');
  });

  it('normalises a query plan from strings or objects', () => {
    const draft = normalizeSourcingBriefDraft({
      queryPlan: [
        'plant heads in Gujarat',
        {
          source: 'bright-data',
          query: 'plant head',
          slice: 'Surat',
          entity: 'people',
        },
        { query: '   ' },
      ],
    });

    expect(draft?.queries).toEqual([
      { query: 'plant heads in Gujarat' },
      {
        source: 'bright-data',
        query: 'plant head',
        slice: 'Surat',
        entity: 'people',
      },
    ]);
  });

  it('accepts a universe written as a sentence', () => {
    const draft = normalizeSourcingBriefDraft({
      universe: 'the 40 companies on the Companies tab',
    });

    expect(draft?.universe).toEqual({
      kind: 'other',
      note: 'the 40 companies on the Companies tab',
    });
  });
});

describe('computePairFunnel per-role pairs', () => {
  it('counts a company with one role found and one role missing as two pairs', () => {
    const funnel = computePairFunnel(
      [
        company('a', [
          pair({ roles: ['CEO'], rungUsed: 1 }),
          pair({
            roles: ['Head of Manufacturing'],
            terminalState: 'none_found',
            reason: 'no_such_role',
            personKeys: [],
          }),
        ]),
      ],
      { roles: ['CEO', 'Head of Manufacturing'] },
    );

    expect(funnel.expectedPairs).toBe(2);
    expect(funnel.pairs).toBe(2);
    expect(funnel.byState).toMatchObject({ found: 1, none_found: 1 });
    expect(funnel.notLookedUp).toBe(0);
    expect(funnel.coverageLine).toContain(
      '1 of 2 company x role pairs covered',
    );
    expect(funnel.coverageLine).toContain('1 none found');
  });

  it('counts a role a company never looked up as a missing pair', () => {
    const funnel = computePairFunnel(
      [company('a', [pair({ roles: ['CEO'] })])],
      { roles: ['CEO', 'Head of Manufacturing'] },
    );

    expect(funnel.expectedPairs).toBe(2);
    expect(funnel.pairs).toBe(1);
    expect(funnel.notLookedUp).toBe(1);
    expect(funnel.coverageLine).toContain('1 pairs not looked up yet');
  });
});

describe('computePairFunnel role scoping', () => {
  it('counts only the pair for the requested roles', () => {
    const funnel = computePairFunnel(
      [
        company('a', [
          pair({ roles: ['CEO'] }),
          pair({
            roles: ['CTO'],
            terminalState: 'none_found',
            reason: 'no_such_role',
            personKeys: [],
          }),
        ]),
        company('b', [pair({ roles: ['CEO'] })]),
      ],
      { roles: ['CTO'] },
    );

    expect(funnel.roleKey).toBe('cto');
    expect(funnel.expectedPairs).toBe(2);
    expect(funnel.pairs).toBe(1);
    expect(funnel.byState.none_found).toBe(1);
    // b has a CEO pair but no CTO pair, so it is not covered for this role
    expect(funnel.notLookedUp).toBe(1);
    expect(funnel.coverageLine).toContain('1 pairs not looked up yet');
  });
});

describe('computeSourcingFrontier', () => {
  const list = {
    id: 'l1',
    sources: ['bright_data'],
    entity: 'people',
    query: 'plant heads in Gujarat',
    fetched: 120,
    newUnique: 80,
    alreadyKnown: 20,
    spentUsd: 0.24,
  };

  it('separates attempted, unattempted and unplanned searches', () => {
    const frontier = computeSourcingFrontier({
      coverage: 'exhaustive',
      universe: { kind: 'project', count: 1 },
      queries: [
        { source: 'bright-data', query: 'plant heads', entity: 'people' },
        { source: 'serp', query: 'plant head Surat', entity: 'people' },
      ],
      searches: [
        list,
        {
          ...list,
          id: 'l2',
          query: 'unplanned query',
          newUnique: 10,
        },
      ],
    });

    expect(frontier?.attempted).toBe(1);
    expect(frontier?.unattempted).toBe(1);
    expect(frontier?.unplannedSearches).toBe(1);
    expect(frontier?.complete).toBe(false);
    expect(frontier?.planned[0]).toMatchObject({
      attempted: true,
      searchIds: ['l1'],
      fetched: 120,
      newUnique: 80,
      alreadyKnown: 20,
    });
    expect(frontier?.unattemptedQueries).toEqual([
      { source: 'serp', query: 'plant head Surat', entity: 'people' },
    ]);
  });

  it('matches an index query to the list stored as "other"', () => {
    const frontier = computeSourcingFrontier({
      coverage: 'exhaustive',
      queries: [
        { source: 'internal-index', query: 'plant head', entity: 'people' },
      ],
      searches: [
        {
          id: 'l3',
          sources: ['other'],
          entity: 'people',
          query: 'plant head',
          fetched: 20,
          spentUsd: 0,
        },
      ],
    });

    expect(frontier?.attempted).toBe(1);
    expect(frontier?.complete).toBe(true);
  });

  it('reports that coverage cannot be proven without a query plan', () => {
    const frontier = computeSourcingFrontier({
      coverage: 'exhaustive',
      searches: [],
    });

    expect(frontier?.complete).toBe(false);
    expect(frontier?.coverageLine).toContain('No query plan recorded');
  });
});

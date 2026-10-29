import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { type FindPeoplePairState } from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import {
  computePairFunnel,
  computeSourcingFunnel,
  mergeSourcingBrief,
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
});

import { FindPeopleCascadeService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-cascade.service';
import {
  type CompanyOutcome,
  type ResolvedInput,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';

const outcome = (overrides: Partial<CompanyOutcome> = {}): CompanyOutcome => ({
  company: 'Acme',
  status: 'no_match',
  people: [],
  rejected: [],
  sourceErrors: [],
  spentUsd: 0.02,
  terminalState: 'none_found',
  reason: 'no_such_role',
  sourcesUsed: ['bright_data', 'google'],
  titlesTried: ['Head of Procurement'],
  ...overrides,
});

const person = {
  name: 'Asha Rao',
  title: 'Founder',
  companyOnProfile: 'Acme',
  linkedinUrl: 'https://www.linkedin.com/in/asha-rao',
  sources: ['bright_data' as const],
  roleMatch: 'exact' as const,
  deprioritisedReasons: [],
  rungUsed: 4 as const,
  confidence: 'medium' as const,
  freshness: 'unknown' as const,
  evidence: [],
};

const input = (plan: Partial<ResolvedInput['plan']> = {}): ResolvedInput =>
  ({
    companies: [],
    roles: ['Head of Procurement'],
    sources: ['bright_data', 'google'],
    plan: {
      maxRung: 4,
      minConfidence: 'medium',
      freshnessDays: 365,
      perPairUsd: 0.1,
      confidential: false,
      ...plan,
    },
  }) as unknown as ResolvedInput;

const buildCache = () => {
  const store = new Map<string, unknown>();

  return {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
};

const build = () => {
  const cache = buildCache();
  const resolveRoles = jest.fn().mockResolvedValue({
    searchTitles: ['Owner', 'Founder'],
    requestedClasses: [],
    taxonomyAvailable: true,
  });
  const service = new FindPeopleCascadeService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { resolveRoles } as never,
    cache as never,
  );
  const lookup = jest.spyOn(service, 'lookupCompanyWithRetries');

  return { service, cache, lookup, resolveRoles };
};

const roles = {
  searchTitles: [],
  requestedClasses: [],
  taxonomyAvailable: true,
};

describe('FindPeopleCascadeService.lookupPair', () => {
  it('should reuse a found answer from the workspace cache for free', async () => {
    const { service, lookup } = build();
    const found = outcome({
      terminalState: 'found',
      status: 'matched',
      people: [{ ...person, rungUsed: 1 }],
    });

    lookup.mockResolvedValueOnce(found);

    await service.lookupPair(
      { name: 'Acme', domain: 'acme.com' },
      input(),
      roles,
      'w',
    );

    const again = await service.lookupPair(
      { name: 'Acme Ltd', domain: 'https://www.acme.com/' },
      input(),
      roles,
      'w',
    );

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(again.sourcesUsed).toEqual(['cache']);
    expect(again.spentUsd).toBe(0);
  });

  it('should not use the cache for a confidential project', async () => {
    const { service, lookup, cache } = build();

    lookup.mockResolvedValue(
      outcome({ terminalState: 'found', people: [{ ...person, rungUsed: 1 }] }),
    );

    await service.lookupPair(
      { name: 'Acme' },
      input({ confidential: true }),
      roles,
      'w',
    );

    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('should try the owner of a small company when the role is not there', async () => {
    const { service, lookup, resolveRoles } = build();

    lookup.mockResolvedValueOnce(outcome()).mockResolvedValueOnce(
      outcome({
        terminalState: 'found',
        status: 'matched',
        people: [person],
        rungUsed: 4,
        spentUsd: 0.01,
        sourcesUsed: ['bright_data'],
        titlesTried: ['Owner', 'Founder'],
      }),
    );

    const result = await service.lookupPair(
      { name: 'Acme', employees: 40 },
      input(),
      roles,
      'w',
    );

    expect(resolveRoles).toHaveBeenCalledWith([
      'Owner',
      'Founder',
      'Managing Director',
      'Promoter',
    ]);
    expect(lookup.mock.calls[1][1].plan.perPairUsd).toBeCloseTo(0.08);
    expect(result.terminalState).toBe('found');
    expect(result.rungUsed).toBe(4);
    expect(result.spentUsd).toBeCloseTo(0.03);
  });

  it('should not try the owner when the plan stops at rung 2 or the company is large', async () => {
    const { service, lookup } = build();

    lookup.mockResolvedValue(outcome());

    await service.lookupPair(
      { name: 'Acme', employees: 40 },
      input({ maxRung: 2 }),
      roles,
      'w',
    );
    await service.lookupPair(
      { name: 'Big Co', employees: 5000 },
      input(),
      roles,
      'w',
    );

    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

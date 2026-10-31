import {
  FindPeopleCascadeService,
  selectPeoplePerRole,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-cascade.service';
import { type PersonJudgement } from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import {
  type Candidate,
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
  sourcesAttempted: ['bright_data', 'google'],
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
  roles: [],
  rolePlans: [],
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

  it('should search again instead of reusing the cache when rerunFound is set', async () => {
    const { service, lookup } = build();

    lookup.mockResolvedValue(
      outcome({ terminalState: 'found', people: [{ ...person, rungUsed: 1 }] }),
    );

    await service.lookupPair(
      { name: 'Acme', domain: 'acme.com' },
      input(),
      roles,
      'w',
    );

    const again = await service.lookupPair(
      { name: 'Acme', domain: 'acme.com' },
      { ...input(), rerunFound: true },
      roles,
      'w',
    );

    // A redo is a paid re-search: the cached pair answer must not stand in for it
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(again.sourcesUsed).not.toEqual(['cache']);
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
        people: [
          {
            ...person,
            rawProfile: {
              about: 'Founder at Acme; runs procurement and supply chain',
            },
          },
        ],
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

  it('should not count a small company founder who does not run the function', async () => {
    const { service, lookup } = build();

    lookup.mockResolvedValueOnce(outcome()).mockResolvedValueOnce(
      outcome({
        terminalState: 'found',
        status: 'matched',
        // A founder with nothing about procurement on the profile
        people: [
          { ...person, rawProfile: { about: 'Founder at a design studio' } },
        ],
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

    expect(result.terminalState).toBe('none_found');
    // the owner pass was still paid for
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

describe('FindPeopleCascadeService per-role fan-out', () => {
  const rolePlans = [
    {
      role: 'Head of Supply Chain',
      sourceMention: 'Head of Supply Chain / Logistics',
      titleClass: {
        functionId: 'supply chain',
        functionRoot: 'supply chain',
        grade: 'leadership',
      },
      similarTitles: ['supply chain director'],
      searchTitles: ['head of supply chain', 'supply chain director'],
      titleExpression: '("Supply Chain" OR SCM OR CSCO) AND (head OR director)',
      googleTitleExpression: '"Supply Chain" AND head',
    },
    {
      role: 'Head of Logistics',
      sourceMention: 'Head of Supply Chain / Logistics',
      titleClass: {
        functionId: 'logistics',
        functionRoot: 'supply chain',
        grade: 'leadership',
      },
      similarTitles: ['logistics director'],
      searchTitles: ['head of logistics', 'logistics director'],
      titleExpression:
        '(logistics OR freight OR transportation) AND (head OR director)',
      googleTitleExpression: '(logistics OR freight) AND head',
    },
    {
      role: 'Procurement Head',
      sourceMention: 'Procurement Head',
      titleClass: {
        functionId: 'procurement',
        functionRoot: 'supply chain',
        grade: 'leadership',
      },
      similarTitles: ['procurement director'],
      searchTitles: ['procurement head', 'procurement director'],
      titleExpression:
        '(procurement OR purchasing OR sourcing) AND (head OR director)',
      googleTitleExpression: '(procurement OR purchasing) AND head',
    },
  ];

  const resolvedRoles = {
    roles: rolePlans.map((plan) => plan.role),
    rolePlans,
    scope: 'role' as const,
    searchTitles: rolePlans.flatMap((plan) => plan.searchTitles),
    requestedClasses: rolePlans.map((plan) => plan.titleClass),
    taxonomyAvailable: true,
    titleExpressions: rolePlans.map((plan) => plan.titleExpression),
    booleanTitleExpression: rolePlans
      .map((plan) => `(${plan.titleExpression})`)
      .join(' OR '),
  };

  const buildFanOut = () => {
    const searchNaturalLanguage = jest.fn().mockResolvedValue({
      result: { documents: [], spentUsd: 0.01 },
    });
    const service = new FindPeopleCascadeService(
      { searchNaturalLanguage } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        classifyTitles: jest.fn(async () => new Map()),
      } as never,
      undefined,
      undefined,
    );

    return { service, searchNaturalLanguage };
  };

  it('should run one Bright Data search per role class with that class filter', async () => {
    const { service, searchNaturalLanguage } = buildFanOut();

    await service.lookupCompanyWithRetries(
      { name: 'Acme', domain: 'acme.com' },
      {
        ...input(),
        roles: resolvedRoles.roles,
        sources: ['bright_data'],
      },
      resolvedRoles as never,
      'w',
    );

    // Procurement appears once even though two roles could share it; here the
    // three roles name three classes
    expect(searchNaturalLanguage).toHaveBeenCalledTimes(3);
    expect(
      searchNaturalLanguage.mock.calls.map(
        ([payload]) =>
          (payload as { titleExpression?: string }).titleExpression,
      ),
    ).toEqual(rolePlans.map((plan) => plan.titleExpression));
  });

  it('should give each role its own per-pair budget share', async () => {
    const { service, searchNaturalLanguage } = buildFanOut();

    await service.lookupCompanyWithRetries(
      { name: 'Acme', domain: 'acme.com' },
      {
        ...input({ perPairUsd: 0.1 }),
        roles: resolvedRoles.roles,
        sources: ['bright_data'],
      },
      resolvedRoles as never,
      'w',
    );

    // Each role's search is capped by one per-pair share, not by the company
    // total: three roles at $0.10 each, one company variant apiece
    expect(
      searchNaturalLanguage.mock.calls.map(
        ([payload]) => (payload as { maxBudgetUsd?: number }).maxBudgetUsd,
      ),
    ).toEqual([0.1, 0.1, 0.1]);
  });
});

describe('FindPeopleCascadeService.verify', () => {
  type Verify = (options: {
    candidates: Candidate[];
    variants: string[];
    roles: string[];
    requestedClasses: [];
    verdicts: Map<string, PersonJudgement>;
  }) => Promise<{ verified: Array<Candidate & { sources: string[] }> }>;

  const verdict = {
    company: 'same',
    companyNote: '',
    role: 'related',
    roleNote: '',
    fitsSearch: true,
    likelyFake: false,
  } as unknown as PersonJudgement;

  const candidate = (overrides: Partial<Candidate>): Candidate => ({
    id: 'candidate',
    name: 'Swarup Pradhan',
    title: 'Associate Director- Procurement',
    companyName: 'Shadowfax',
    linkedinUrl: '',
    evidenceText: '',
    source: 'google',
    ...overrides,
  });

  const verifyOf = () => {
    const service = new FindPeopleCascadeService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { classifyTitles: jest.fn().mockResolvedValue(null) } as never,
    );

    return (service as unknown as { verify: Verify }).verify.bind(service);
  };

  it('should return one person found with a member id and a vanity slug', async () => {
    const candidates = [
      candidate({
        id: 'google',
        linkedinUrl: 'https://in.linkedin.com/in/swarup-pradhan007',
        source: 'google',
      }),
      candidate({
        id: 'harvest',
        linkedinUrl:
          'https://www.linkedin.com/in/ACwAACFhfkMBEWWuptYnb9ofbq2aKmV_YN_b-Nw',
        source: 'harvest',
      }),
    ];

    const { verified } = await verifyOf()({
      candidates,
      variants: ['Shadowfax'],
      roles: ['Procurement Head'],
      requestedClasses: [],
      verdicts: new Map(candidates.map((entry) => [entry.id, verdict])),
    });

    expect(verified).toHaveLength(1);
    expect(verified[0].linkedinUrl).toBe(
      'https://in.linkedin.com/in/swarup-pradhan007',
    );
    expect(verified[0].sources).toEqual(['google', 'harvest']);
  });

  it('should keep two people with different vanity slugs apart', async () => {
    const candidates = [
      candidate({
        id: 'first',
        linkedinUrl: 'https://in.linkedin.com/in/swarup-pradhan007',
      }),
      candidate({
        id: 'second',
        linkedinUrl: 'https://in.linkedin.com/in/swarup-pradhan-8ab67b137',
      }),
    ];

    const { verified } = await verifyOf()({
      candidates,
      variants: ['Shadowfax'],
      roles: ['Procurement Head'],
      requestedClasses: [],
      verdicts: new Map(candidates.map((entry) => [entry.id, verdict])),
    });

    expect(verified).toHaveLength(2);
  });
});

describe('selectPeoplePerRole', () => {
  const holder = (name: string, roles: string[]) => ({
    name,
    roleMatches: roles.map((role) => ({ role, score: 2 as const })),
  });

  it('should keep each role its own places when one role has many holders', () => {
    const ranked = [
      holder('A', ['Head of Supply Chain']),
      holder('B', ['Head of Supply Chain']),
      holder('C', ['Head of Supply Chain']),
      holder('D', ['Head of Supply Chain']),
      holder('E', ['Head of Supply Chain']),
      holder('F', ['Head of Supply Chain']),
      holder('P', ['Procurement Head']),
    ];

    const kept = selectPeoplePerRole(ranked, [
      'Head of Supply Chain',
      'Procurement Head',
    ]).map((person) => person.name);

    expect(kept).toEqual(['A', 'B', 'C', 'P']);
  });

  it('should keep a person serving two roles once, in rank order', () => {
    const ranked = [
      holder('Both', ['Procurement Head', 'Chief Procurement Officer']),
      holder('Second', ['Procurement Head']),
    ];

    expect(
      selectPeoplePerRole(ranked, [
        'Procurement Head',
        'Chief Procurement Officer',
      ]).map((person) => person.name),
    ).toEqual(['Both', 'Second']);
  });

  it('should fill up to three with people tied to no requested role', () => {
    const ranked = [
      holder('Matched', ['Procurement Head']),
      holder('Loose1', []),
      holder('Loose2', []),
      holder('Loose3', []),
    ];

    expect(
      selectPeoplePerRole(ranked, ['Procurement Head']).map(
        (person) => person.name,
      ),
    ).toEqual(['Matched', 'Loose1', 'Loose2']);
  });
});

describe('FindPeopleCascadeService source order on a redo', () => {
  const confidentHead: Candidate = {
    id: 'bd-1',
    name: 'Maheswaran K',
    title: 'Head of Supply Chain Management',
    companyName: 'Milky Mist',
    linkedinUrl: 'https://www.linkedin.com/in/maheswaran-k',
    evidenceText: '',
    source: 'bright_data',
  };

  const buildCascade = () => {
    const searchCompany = jest
      .fn()
      .mockResolvedValue({ results: [], aiOverviewTexts: [], errors: [] });
    const service = new FindPeopleCascadeService(
      {} as never,
      { searchCompany } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { classifyTitles: jest.fn(async () => new Map()) } as never,
      undefined,
      {
        isConfigured: () => true,
        findCompanyLinkedinUrl: jest.fn(async () => null),
      } as never,
    );
    const internals = service as unknown as Record<string, jest.Mock>;
    const searchHarvest = jest
      .fn()
      .mockResolvedValue({ candidates: [], spentUsd: 0, errors: [] });

    internals.searchBrightData = jest
      .fn()
      .mockResolvedValue({ candidates: [{ ...confidentHead }], spentUsd: 0 });
    internals.judgeCandidates = jest.fn(
      async ({ candidates }: { candidates: Candidate[] }) =>
        new Map(
          candidates.map((entry) => [
            entry.id,
            {
              company: 'same',
              companyNote: '',
              role: 'exact',
              roleNote: '',
              fitsSearch: true,
              likelyFake: false,
            } as unknown as PersonJudgement,
          ]),
        ),
    );
    internals.confidenceOfCandidate = jest.fn(() => 'high');
    internals.searchSerpSources = jest
      .fn()
      .mockResolvedValue({ candidates: [], errors: [] });
    internals.extractPeople = jest.fn().mockResolvedValue([]);
    internals.enrichGoogleCandidates = jest
      .fn()
      .mockResolvedValue({ candidates: [], spentUsd: 0 });
    internals.resolveNamedPeople = jest
      .fn()
      .mockResolvedValue({ candidates: [], spentUsd: 0, errors: [] });
    internals.searchHarvest = searchHarvest;

    return { service, searchCompany, searchHarvest };
  };

  const lookup = (service: FindPeopleCascadeService, rerunFound: boolean) =>
    service.lookupCompanyWithRetries(
      { name: 'Milky Mist', domain: 'milkymist.com' },
      {
        ...input(),
        roles: ['Head of Supply Chain'],
        sources: ['bright_data', 'google', 'harvest'],
        rerunFound,
      },
      roles as never,
      'w',
    );

  it('should stop at Bright Data when it already holds a confident match', async () => {
    const { service, searchCompany, searchHarvest } = buildCascade();

    await lookup(service, false);

    expect(searchCompany).not.toHaveBeenCalled();
    expect(searchHarvest).not.toHaveBeenCalled();
  });

  it('should ask Google and Harvest too on a redo', async () => {
    const { service, searchCompany, searchHarvest } = buildCascade();

    const result = await lookup(service, true);

    expect(searchCompany).toHaveBeenCalledTimes(1);
    expect(searchHarvest).toHaveBeenCalledTimes(1);
    expect(result.sourcesAttempted).toEqual([
      'bright_data',
      'google',
      'harvest',
    ]);
  });
});

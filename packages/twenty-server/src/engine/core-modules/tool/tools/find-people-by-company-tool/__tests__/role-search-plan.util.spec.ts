import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';
import {
  buildRoleSearches,
  cellStage,
  MAX_TITLES_PER_ROLE_QUERY,
  splitTitlesByTier,
  tieredSearchesOf,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/role-search-plan.util';
import { type ResolvedRoles } from 'src/engine/core-modules/title-taxonomy/title-expansion.service';

const SUPPLY_CHAIN: TitleClass = {
  functionId: 'supply chain',
  functionRoot: 'supply chain',
  grade: 'leadership',
};
const LOGISTICS: TitleClass = {
  functionId: 'logistics',
  functionRoot: 'supply chain',
  grade: 'leadership',
};
const PROCUREMENT: TitleClass = {
  functionId: 'procurement',
  functionRoot: 'supply chain',
  grade: 'leadership',
};

const resolved = (rolePlans: ResolvedRoles['rolePlans']): ResolvedRoles => ({
  roles: rolePlans.map((plan) => plan.role),
  rolePlans,
  searchTitles: [],
  requestedClasses: [],
  taxonomyAvailable: true,
  scope: 'role' as const,
});

const plan = (
  role: string,
  titleClass: TitleClass | null,
  titleExpression: string | null,
  titles: string[] = [role.toLowerCase()],
): ResolvedRoles['rolePlans'][number] => ({
  role,
  sourceMention: role,
  titleClass,
  similarTitles: [],
  searchTitles: titles,
  titleExpression,
  googleTitleExpression: titleExpression,
});

describe('buildRoleSearches', () => {
  it('should run one search per taxonomy class, not per role', () => {
    const searches = buildRoleSearches(
      resolved([
        plan(
          'Head of Supply Chain',
          SUPPLY_CHAIN,
          '("Supply Chain" OR SCM) AND head',
        ),
        plan('Head of Logistics', LOGISTICS, '(logistics OR freight) AND head'),
        plan(
          'Procurement Head',
          PROCUREMENT,
          '(procurement OR sourcing) AND head',
        ),
        plan(
          'Chief Procurement Officer',
          PROCUREMENT,
          '(procurement OR sourcing) AND head',
        ),
      ]),
      [
        'Head of Supply Chain',
        'Head of Logistics',
        'Procurement Head',
        'Chief Procurement Officer',
      ],
    );

    expect(searches).toHaveLength(3);
    expect(searches.map((search) => search.titleExpression)).toEqual([
      '("Supply Chain" OR SCM) AND head',
      '(logistics OR freight) AND head',
      '(procurement OR sourcing) AND head',
    ]);
    // The two procurement roles share one paid search but keep both labels
    expect(searches[2].roles).toEqual([
      'Procurement Head',
      'Chief Procurement Officer',
    ]);
  });

  it('should keep an unclassified role on its own search', () => {
    const searches = buildRoleSearches(
      resolved([
        plan('Head of Logistics', LOGISTICS, '(logistics OR freight) AND head'),
        plan('Purchase Head', null, null, ['purchase head']),
      ]),
      ['Head of Logistics', 'Purchase Head'],
    );

    expect(searches).toHaveLength(2);
    expect(searches[1]).toMatchObject({
      roles: ['Purchase Head'],
      titleExpression: null,
      titles: ['purchase head'],
    });
  });

  it('should cap each role search, not the union', () => {
    const manyTitles = Array.from(
      { length: 12 },
      (_, index) => `title ${index}`,
    );
    const searches = buildRoleSearches(
      resolved([
        plan('Head of Logistics', LOGISTICS, 'logistics AND head', manyTitles),
        plan(
          'Procurement Head',
          PROCUREMENT,
          'procurement AND head',
          manyTitles,
        ),
      ]),
      ['Head of Logistics', 'Procurement Head'],
    );

    expect(searches).toHaveLength(2);
    for (const search of searches) {
      expect(search.titles).toHaveLength(MAX_TITLES_PER_ROLE_QUERY);
    }
  });

  it('should fall back to one merged search without a per-role plan', () => {
    const searches = buildRoleSearches(
      {
        searchTitles: ['head of procurement', 'procurement director'],
        requestedClasses: [PROCUREMENT],
        taxonomyAvailable: true,
        scope: 'role' as const,
        booleanTitleExpression: '(procurement OR sourcing) AND head',
      } as ResolvedRoles,
      ['Head of Procurement'],
    );

    expect(searches).toEqual([
      {
        key: 'all',
        roles: ['Head of Procurement'],
        titles: ['head of procurement', 'procurement director'],
        titleExpression: '(procurement OR sourcing) AND head',
      },
    ]);
  });
});

describe('tiered cell searches', () => {
  it('should split titles into seniority tiers, top tier first', () => {
    expect(
      splitTitlesByTier([
        'Procurement Manager',
        'Director Procurement',
        'Head of Procurement',
        'Chief Procurement Officer',
      ]),
    ).toEqual([
      ['Head of Procurement', 'Chief Procurement Officer'],
      ['Director Procurement'],
      ['Procurement Manager'],
    ]);
  });

  it('should keep a curated boolean filter as one search', () => {
    expect(
      tieredSearchesOf({
        key: 'procurement',
        roles: ['Procurement Head'],
        titles: ['Head of Procurement', 'Procurement Manager'],
        titleExpression: '"procurement" AND head',
      }),
    ).toEqual([
      {
        titles: ['Head of Procurement', 'Procurement Manager'],
        tier: 'boolean',
      },
    ]);
  });

  it('should still search once when a role has no titles', () => {
    expect(
      tieredSearchesOf({
        key: 'all',
        roles: ['Owner'],
        titles: [],
        titleExpression: null,
      }),
    ).toEqual([{ titles: [], tier: 1 }]);
  });

  it('should name the ledger stage after the cell', () => {
    expect(
      cellStage({ familyKey: 'procurement', source: 'harvest', tier: 2 }),
    ).toBe('cell:procurement|harvest|t2');
  });
});

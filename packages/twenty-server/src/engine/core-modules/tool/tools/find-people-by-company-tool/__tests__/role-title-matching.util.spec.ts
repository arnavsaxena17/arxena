import {
  closestRequestedRole,
  getRequestedRoleOrder,
  isLeadershipCandidateTitle,
  scoreRoleMatch,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/role-title-matching.util';
import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';

const CEO_CLASS: TitleClass = {
  functionId: 'ceo',
  functionRoot: 'ceo',
  grade: 'leadership',
};
const HR_CLASS: TitleClass = {
  functionId: 'human resources',
  functionRoot: 'human resources',
  grade: 'leadership',
};
const ROLES = ['ceo', 'md', 'founder'];

const score = (title: string, candidateClass: TitleClass | null) =>
  scoreRoleMatch({
    title,
    roles: ROLES,
    requestedClasses: [CEO_CLASS],
    candidateClass,
  });

describe('scoreRoleMatch', () => {
  it('should accept a title the taxonomy puts in the requested function', () => {
    expect(score('Chief Executive Officer', CEO_CLASS)).toBe(2);
    expect(score('Managing Director', CEO_CLASS)).toBe(2);
  });

  it('should reject a title that works for the role instead of holding it', () => {
    expect(score('Manager - CEO Office', CEO_CLASS)).toBe(0);
    expect(score('Head of Finance & Growth | CEO Office', null)).toBe(0);
    expect(score("Executive, Chairman's Office", null)).toBe(0);
    expect(score('Office of the MD', null)).toBe(0);
  });

  it('should still accept a combined CEO title', () => {
    expect(score('Founder & CEO', CEO_CLASS)).toBe(2);
    expect(score('CEO | Officer of the Year', CEO_CLASS)).toBe(2);
  });

  it('should read a typed short role against the spelled-out title when the taxonomy has no answer', () => {
    const noTaxonomy = (title: string, roles: string[]) =>
      scoreRoleMatch({
        title,
        roles,
        requestedClasses: [],
        candidateClass: null,
      });

    expect(noTaxonomy('Group Chief Executive Officer', ['CEO'])).toBe(2);
    expect(noTaxonomy('Founder, Chairman & Managing Director', ['MD'])).toBe(2);
    expect(noTaxonomy('Chief Executive Officer', ['MD', 'CEO'])).toBe(2);
    expect(noTaxonomy('Managing Director', ['md'])).toBe(2);
    // and the other way round
    expect(noTaxonomy('CEO', ['chief executive officer'])).toBe(2);
    expect(noTaxonomy('MD & CEO', ['managing director'])).toBe(2);
  });

  it('should not widen a short role to an unrelated title', () => {
    const noTaxonomy = (title: string, roles: string[]) =>
      scoreRoleMatch({
        title,
        roles,
        requestedClasses: [],
        candidateClass: null,
      });

    expect(noTaxonomy('Chief Financial Officer', ['CEO'])).toBe(0);
    expect(noTaxonomy('Director of Operations', ['MD'])).toBe(0);
    expect(noTaxonomy('Deputy Chief Executive Officer', ['CEO'])).toBe(1);
  });

  it('should order people by the role the user named first', () => {
    expect(
      getRequestedRoleOrder('Group Managing Director', ['CEO', 'MD']),
    ).toBe(1);
    expect(
      getRequestedRoleOrder('Chief Executive Officer', ['CEO', 'MD']),
    ).toBe(0);
  });

  it('should reject a title from another function', () => {
    expect(score('General Manager Human Resources', HR_CLASS)).toBe(0);
  });

  it('should reject a sibling function in role scope and keep it in family scope', () => {
    const SUPPLY_CHAIN_CLASS: TitleClass = {
      functionId: 'supply chain',
      functionRoot: 'supply chain',
      grade: 'leadership',
    };
    const LOGISTICS_CLASS: TitleClass = {
      functionId: 'logistics',
      functionRoot: 'supply chain',
      grade: 'leadership',
    };
    const PROCUREMENT_CLASS: TitleClass = {
      functionId: 'procurement',
      functionRoot: 'supply chain',
      grade: 'leadership',
    };
    const scoreFor = (
      title: string,
      candidateClass: TitleClass,
      scope: 'role' | 'family' = 'role',
    ) =>
      scoreRoleMatch({
        title,
        roles: ['Head of Supply Chain'],
        requestedClasses: [SUPPLY_CHAIN_CLASS],
        candidateClass,
        scope,
      });

    // Role scope: logistics/procurement lead different functions, not the
    // supply chain role the user asked for.
    expect(scoreFor('Head of Logistics', LOGISTICS_CLASS)).toBe(0);
    expect(scoreFor('Head of Procurement', PROCUREMENT_CLASS)).toBe(0);
    // Family/coverage scope keeps the related rung.
    expect(scoreFor('Head of Logistics', LOGISTICS_CLASS, 'family')).toBe(1);
    expect(scoreFor('Head of Procurement', PROCUREMENT_CLASS, 'family')).toBe(
      1,
    );
    // The exact function still outranks the sibling
    expect(scoreFor('Head of Supply Chain', SUPPLY_CHAIN_CLASS)).toBe(2);
    // Naming the child function in the request makes it relevant again.
    expect(
      scoreRoleMatch({
        title: 'Head of Logistics',
        roles: ['Head of Supply Chain & Logistics'],
        requestedClasses: [SUPPLY_CHAIN_CLASS, PROCUREMENT_CLASS],
        candidateClass: LOGISTICS_CLASS,
      }),
    ).toBe(1);
  });

  it('should accept an industrial operations head for a manufacturing request, not the reverse', () => {
    const MANUFACTURING_CLASS: TitleClass = {
      functionId: 'manufacturing',
      functionRoot: 'engineering',
      grade: 'leadership',
    };
    const OPERATIONS_CLASS: TitleClass = {
      functionId: 'operations',
      functionRoot: 'operations',
      grade: 'leadership',
    };

    expect(
      scoreRoleMatch({
        title: 'Head of Operations',
        roles: ['Head of Manufacturing'],
        requestedClasses: [MANUFACTURING_CLASS],
        candidateClass: OPERATIONS_CLASS,
      }),
    ).toBe(2);
    // Directional: operations is broader, so it must not collapse to manufacturing
    expect(
      scoreRoleMatch({
        title: 'Head of Manufacturing',
        roles: ['Head of Operations'],
        requestedClasses: [OPERATIONS_CLASS],
        candidateClass: MANUFACTURING_CLASS,
      }),
    ).toBe(0);
  });

  it('should not treat another root as a sibling', () => {
    const SUPPLY_CHAIN_CLASS: TitleClass = {
      functionId: 'supply chain',
      functionRoot: 'supply chain',
      grade: 'leadership',
    };

    expect(
      scoreRoleMatch({
        title: 'Head of Sales',
        roles: ['Head of Supply Chain'],
        requestedClasses: [SUPPLY_CHAIN_CLASS],
        candidateClass: {
          functionId: 'sales',
          functionRoot: 'sales',
          grade: 'leadership',
        },
      }),
    ).toBe(0);
  });

  it('should reject a same-function title of a different grade', () => {
    expect(score('Chief of Staff', { ...CEO_CLASS, grade: 'entry' })).toBe(0);
  });

  it('should fall back to the role as typed when the taxonomy has no class', () => {
    expect(score('Owner & Founder', null)).toBe(2);
    expect(score('Head of Sales', null)).toBe(0);
  });

  it('should not match a typed role inside another word', () => {
    expect(score('Pharmd Intern', null)).toBe(0);
  });

  it('should score a deputy as related and drop assistants and former holders', () => {
    expect(score('Deputy CEO', CEO_CLASS)).toBe(1);
    expect(score('Assistant to the CEO', CEO_CLASS)).toBe(0);
    expect(score('Former CEO', CEO_CLASS)).toBe(0);
    expect(score('', CEO_CLASS)).toBe(0);
  });

  it('should work with no requested classes at all', () => {
    expect(
      scoreRoleMatch({
        title: 'CEO',
        roles: ['ceo'],
        requestedClasses: [],
        candidateClass: CEO_CLASS,
      }),
    ).toBe(2);
  });
});

describe('getRequestedRoleOrder', () => {
  it('should order by the roles in the order the user gave them', () => {
    expect(getRequestedRoleOrder('Founder', ROLES)).toBeGreaterThan(
      getRequestedRoleOrder('CEO', ROLES),
    );
    expect(getRequestedRoleOrder('Head of Sales', ROLES)).toBe(ROLES.length);
  });
});

describe('role attribution across requested roles', () => {
  it('should match a role written in the other word order', () => {
    expect(
      scoreRoleMatch({
        title: 'Head of Procurement',
        roles: ['Procurement Head'],
        requestedClasses: [],
        candidateClass: null,
      }),
    ).toBe(2);
  });

  it('should not match a bare grade word to every role', () => {
    expect(
      scoreRoleMatch({
        title: 'Head of Sales',
        roles: ['Procurement Head'],
        requestedClasses: [],
        candidateClass: null,
      }),
    ).toBe(0);
  });

  it('should file a judge-kept person under the role their title is closest to', () => {
    expect(
      closestRequestedRole('Chief Procurement Officer', [
        'Head of Supply Chain',
        'Procurement Head',
      ]),
    ).toBe('Procurement Head');
  });

  it('should fall back to the role whose query found the person on a tie', () => {
    expect(
      closestRequestedRole(
        'Vice President',
        ['Head of Supply Chain', 'Procurement Head'],
        'Procurement Head',
      ),
    ).toBe('Procurement Head');
  });
});

describe('isLeadershipCandidateTitle', () => {
  it.each([
    'Head of Procurement',
    'Associate Director - Supply Chain',
    'Chief Executive Officer',
    'Senior Manager Procurement',
    '',
  ])('should look up %p', (title) => {
    expect(isLeadershipCandidateTitle(title)).toBe(true);
  });

  it.each(['Assistant Manager', 'Operations Manager', 'Procurement Executive'])(
    'should not pay to look up %p',
    (title) => {
      expect(isLeadershipCandidateTitle(title)).toBe(false);
    },
  );
});

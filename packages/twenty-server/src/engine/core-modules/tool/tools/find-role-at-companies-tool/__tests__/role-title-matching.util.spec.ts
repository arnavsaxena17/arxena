import {
  getRequestedRoleOrder,
  scoreRoleMatch,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/role-title-matching.util';
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

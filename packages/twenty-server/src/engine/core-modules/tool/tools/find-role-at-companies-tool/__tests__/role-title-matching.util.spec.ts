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

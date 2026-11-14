import {
  classificationToResolvedFields,
  type TaxonomyResolvedFields,
} from '../filter-people-by-taxonomy.util';
import {
  pickCurrentPositionForSearchIntent,
} from '../pick-current-position-for-search-intent.util';

const gopala = {
  name: 'Gopala Krishnan',
  current_positions: [
    {
      role: 'Group President',
      company: 'Hinduja Group Limited',
      company_id: '946958',
    },
    {
      role: 'Director',
      company: 'Other Board Seat',
      company_id: '111',
    },
  ],
};

const gaurav = {
  name: 'Gaurav Mittal',
  current_positions: [
    {
      role: 'Founder',
      company: 'Namokar',
      company_id: null,
    },
  ],
};

describe('pickCurrentPositionForSearchIntent', () => {
  it('keeps the Hinduja company_id role and skips Namokar on a Hinduja search', () => {
    const intent = { companyId: '946958', companyName: 'Hinduja Hospital' };

    expect(
      pickCurrentPositionForSearchIntent(gopala, intent)?.company,
    ).toBe('Hinduja Group Limited');
    expect(pickCurrentPositionForSearchIntent(gaurav, intent)).toBeUndefined();
  });

  it('picks the current role whose taxonomy matches and skips when none match', () => {
    const classified = new Map<string, TaxonomyResolvedFields>([
      [
        'chief financial officer',
        classificationToResolvedFields({
          title: 'cfo',
          normalized_title: 'cfo',
          function: { id: 'finance', name: 'finance' },
          function_root: { id: 'finance', name: 'finance' },
          grade: { id: 'leadership', name: 'leadership' },
          confidence: 0.9,
        }),
      ],
      [
        'piano teacher',
        classificationToResolvedFields({
          title: 'piano teacher',
          normalized_title: 'piano teacher',
          function: { id: 'education', name: 'education' },
          function_root: { id: 'education', name: 'education' },
          grade: { id: 'mid', name: 'mid' },
          confidence: 0.8,
        }),
      ],
    ]);
    const person = {
      current_positions: [
        { role: 'Piano Teacher', company: 'Music School', company_id: '1' },
        { role: 'Chief Financial Officer', company: 'Acme', company_id: '2' },
      ],
    };

    expect(
      pickCurrentPositionForSearchIntent(
        person,
        { stdFunctionRoot: 'finance' },
        classified,
      )?.company,
    ).toBe('Acme');
    expect(
      pickCurrentPositionForSearchIntent(
        person,
        { stdFunctionRoot: 'engineering' },
        classified,
      ),
    ).toBeUndefined();
  });

  it('picks a leadership-grade role for Sales Nav seniority-only intent', () => {
    const classified = new Map<string, TaxonomyResolvedFields>([
      [
        'director of operations',
        classificationToResolvedFields({
          title: 'director of operations',
          normalized_title: 'director of operations',
          function: { id: 'operations', name: 'operations' },
          function_root: { id: 'operations', name: 'operations' },
          grade: { id: 'leadership', name: 'leadership' },
          confidence: 0.9,
        }),
      ],
      [
        'analyst',
        classificationToResolvedFields({
          title: 'analyst',
          normalized_title: 'analyst',
          function: { id: 'finance', name: 'finance' },
          function_root: { id: 'finance', name: 'finance' },
          grade: { id: 'entry', name: 'entry' },
          confidence: 0.8,
        }),
      ],
    ]);

    expect(
      pickCurrentPositionForSearchIntent(
        {
          current_positions: [
            { role: 'Analyst', company: 'Acme', company_id: '1' },
            { role: 'Director of Operations', company: 'Acme', company_id: '1' },
          ],
        },
        { salesNavSeniorities: ['director'] },
        classified,
      )?.role,
    ).toBe('Director of Operations');
  });
});

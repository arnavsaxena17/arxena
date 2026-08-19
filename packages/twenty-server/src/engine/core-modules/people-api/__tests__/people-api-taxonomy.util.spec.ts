import { buildTaxonomyTreeFromFlatLists } from '../utils/build-taxonomy-tree.util';
import { extractCandidateExperience } from '../utils/extract-candidate-experience.util';
import { extractCandidateJobTitle } from '../utils/extract-candidate-job-title.util';
import {
  classificationToResolvedFields,
  matchesTaxonomyFilter,
} from '../utils/filter-people-by-taxonomy.util';

describe('buildTaxonomyTreeFromFlatLists', () => {
  it('nests functions under matching parent_id roots', () => {
    const tree = buildTaxonomyTreeFromFlatLists(
      [
        {
          id: 'engineering',
          label: 'engineering',
          name: 'engineering',
          parent_id: null,
          level: 1,
        },
        {
          id: 'sales',
          label: 'sales',
          name: 'sales',
          parent_id: null,
          level: 1,
        },
      ],
      [
        {
          id: 'software engineering',
          label: 'software engineering',
          name: 'software engineering',
          parent_id: 'engineering',
          level: 2,
        },
        {
          id: 'account management',
          label: 'account management',
          name: 'account management',
          parent_id: 'sales',
          level: 2,
        },
      ],
    );

    expect(tree).toEqual([
      {
        id: 'engineering',
        label: 'engineering',
        functions: [
          {
            id: 'software engineering',
            label: 'software engineering',
          },
        ],
      },
      {
        id: 'sales',
        label: 'sales',
        functions: [
          {
            id: 'account management',
            label: 'account management',
          },
        ],
      },
    ]);
  });
});

describe('extractCandidateJobTitle', () => {
  it('prefers jobTitle then currentPositions title', () => {
    expect(extractCandidateJobTitle({ jobTitle: 'VP Sales' })).toBe('VP Sales');
    expect(
      extractCandidateJobTitle({
        currentPositions: [{ title: 'Account Executive' }],
      }),
    ).toBe('Account Executive');
  });
});

describe('extractCandidateExperience', () => {
  it('reads nested title.name and snake_case dates', () => {
    expect(
      extractCandidateExperience({
        experience: [
          {
            title: { name: 'VP Product' },
            start_date: '2022-01-01',
            end_date: '2024-06-01',
            is_current: false,
          },
          { title: '  ' },
        ],
      }),
    ).toEqual([
      {
        title: 'VP Product',
        startDate: '2022-01-01',
        endDate: '2024-06-01',
        isCurrent: false,
      },
    ]);
  });
});

describe('matchesTaxonomyFilter', () => {
  const resolved = classificationToResolvedFields({
    title: 'VP Engineering',
    normalized_title: 'vp engineering',
    function_root: {
      id: 'engineering',
      label: 'engineering',
      name: 'engineering',
      parent_id: null,
      level: 1,
    },
    function: {
      id: 'software engineering',
      label: 'software engineering',
      name: 'software engineering',
      parent_id: 'engineering',
      level: 2,
    },
    grade: {
      id: 'leadership',
      label: 'leadership',
      name: 'leadership',
      parent_id: null,
      level: null,
    },
    confidence: 0.9,
  });

  it('matches function root and optional grade', () => {
    expect(
      matchesTaxonomyFilter(resolved, {
        stdFunctionRoot: 'engineering',
        stdGrade: 'leadership',
      }),
    ).toBe(true);
    expect(
      matchesTaxonomyFilter(resolved, {
        stdFunctionRoot: 'engineering',
        stdGrade: 'entry',
      }),
    ).toBe(false);
  });

  it('requires a function dimension', () => {
    expect(
      matchesTaxonomyFilter(resolved, {
        stdGrade: 'leadership',
      }),
    ).toBe(false);
  });
});

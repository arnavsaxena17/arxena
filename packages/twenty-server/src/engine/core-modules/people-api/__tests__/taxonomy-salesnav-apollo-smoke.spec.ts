import {
  resolveApolloFilters,
  resolveSalesNavFilters,
} from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';

import {
  classificationToResolvedFields,
  matchesTaxonomyFilter,
} from '../utils/filter-people-by-taxonomy.util';

describe('taxonomy → Sales Nav / Apollo smoke', () => {
  it('maps a classified HR Head title to SN + Apollo filters and post-filters', () => {
    const classification = {
      title: 'Head of People',
      normalized_title: 'head of people',
      function_root: {
        id: 'human resources',
        label: 'human resources',
        name: 'human resources',
        parent_id: null,
        level: 1,
      },
      function: {
        id: 'human resources',
        label: 'human resources',
        name: 'human resources',
        parent_id: 'human resources',
        level: 2,
      },
      grade: {
        id: 'leadership',
        label: 'leadership',
        name: 'leadership',
        parent_id: 'senior',
        level: 'senior',
      },
      confidence: 0.75,
    };

    const resolved = classificationToResolvedFields(classification);
    const salesNav = resolveSalesNavFilters({
      functionRoot: resolved.stdFunctionRoot,
      stdFunction: resolved.stdFunction,
      stdGrade: resolved.stdGrade,
    });
    const apollo = resolveApolloFilters({
      functionRoot: resolved.stdFunctionRoot,
      stdFunction: resolved.stdFunction,
      stdGrade: resolved.stdGrade,
    });

    expect(salesNav.functionIds).toEqual(['12']);
    expect(salesNav.seniorities).toEqual(
      expect.arrayContaining(['cxo', 'director', 'vice_president']),
    );
    expect(apollo.person_department_or_subdepartments.length).toBeGreaterThan(
      0,
    );
    expect(apollo.person_seniorities).toEqual(
      expect.arrayContaining(['c_suite', 'vp', 'head', 'director']),
    );

    expect(
      matchesTaxonomyFilter(resolved, {
        stdFunctionRoot: 'human resources',
        stdGrade: 'leadership',
      }),
    ).toBe(true);

    expect(
      matchesTaxonomyFilter(
        {
          stdFunction: 'engineering',
          stdFunctionRoot: 'engineering',
          stdGrade: 'entry',
          confidence: 0.75,
        },
        {
          stdFunctionRoot: 'human resources',
          stdGrade: 'leadership',
        },
      ),
    ).toBe(false);
  });
});

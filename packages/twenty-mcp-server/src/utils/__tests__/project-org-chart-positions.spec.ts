import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { projectOrgChartPositions } from '../project-org-chart-positions';

describe('projectOrgChartPositions', () => {
  it('strips candidates and projects compact rows from an array orgchart', () => {
    const positions = projectOrgChartPositions({
      orgchart: [
        {
          key: 1,
          parent: '',
          headline: 'Software Leadership',
          std_function_root: 'technology',
          std_function: 'software',
          std_grade: 'leadership',
          country: 'global',
          len_candidates: 2,
          candidates: [
            { full_name: 'Ada Lovelace', title: 'VP Engineering' },
            { full_name: 'Grace Hopper', title: 'Director' },
          ],
          name_0: 'Ada Lovelace',
          linkedin_url_0: 'https://linkedin.com/in/ada',
        },
        {
          key: 2,
          parent: 1,
          headline: 'Cloud Platform',
          std_function_root: 'technology',
          std_function: 'infrastructure',
          std_grade: 'mid',
          len_candidates: '3',
        },
      ],
    });

    assert.equal(positions.length, 2);
    assert.deepEqual(positions[0], {
      key: 1,
      parent: '',
      headline: 'Software Leadership',
      std_function_root: 'technology',
      std_function: 'software',
      std_grade: 'leadership',
      country: 'global',
      peopleCount: 2,
    });
    assert.equal(positions[1].peopleCount, 3);
    assert.equal(
      Object.prototype.hasOwnProperty.call(positions[0], 'candidates'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(positions[0], 'name_0'),
      false,
    );
  });

  it('parses stringified orgchart JSON', () => {
    const positions = projectOrgChartPositions({
      orgchart: JSON.stringify([
        {
          key: '10',
          parent: '0',
          headline: 'Finance Team',
          std_function_root: 'finance',
          std_function: 'finance',
          std_grade: 'mid',
          candidates: { full_name: 'Only One' },
        },
      ]),
    });

    assert.equal(positions.length, 1);
    assert.equal(positions[0].key, 10);
    assert.equal(positions[0].parent, 0);
    assert.equal(positions[0].peopleCount, 1);
  });

  it('applies taxonomy, headline, and limit filters', () => {
    const orgChartData = {
      orgchart: [
        {
          key: 1,
          headline: 'Software Team',
          std_function_root: 'technology',
          std_function: 'software',
          std_grade: 'mid',
          len_candidates: 5,
        },
        {
          key: 2,
          headline: 'Cloud Infrastructure',
          std_function_root: 'technology',
          std_function: 'infrastructure',
          std_grade: 'leadership',
          len_candidates: 4,
        },
        {
          key: 3,
          headline: 'Sales Team',
          std_function_root: 'sales',
          std_function: 'sales',
          std_grade: 'mid',
          len_candidates: 8,
        },
      ],
    };

    const filtered = projectOrgChartPositions(orgChartData, {
      stdFunctionRoot: 'technology',
      headlineContains: 'cloud',
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].key, 2);

    const limited = projectOrgChartPositions(orgChartData, {
      stdFunctionRoot: 'technology',
      limit: 1,
    });

    assert.equal(limited.length, 1);
    assert.equal(limited[0].key, 1);
  });
});

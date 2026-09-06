import { findOrgChartNodeByKey } from 'src/engine/core-modules/org-chart/utils/find-org-chart-node-by-key.util';

describe('findOrgChartNodeByKey', () => {
  it('resolves taxonomy and headline for a numeric key', () => {
    const node = findOrgChartNodeByKey(
      {
        orgchart: [
          {
            key: 42,
            parent: 1,
            headline: 'Cloud Infrastructure',
            std_function_root: 'technology',
            std_function: 'infrastructure',
            std_grade: 'leadership',
            country: 'global',
            len_candidates: 3,
            candidates: [{ full_name: 'Ada' }],
          },
        ],
      },
      42,
    );

    expect(node).toEqual({
      key: 42,
      parent: 1,
      headline: 'Cloud Infrastructure',
      stdFunctionRoot: 'technology',
      stdFunction: 'infrastructure',
      stdGrade: 'leadership',
      country: 'global',
      peopleCount: 3,
    });
  });

  it('parses stringified orgchart and returns null for missing keys', () => {
    const orgChartData = {
      orgchart: JSON.stringify([
        {
          key: '7',
          parent: '',
          headline: 'Finance Team',
          std_function: 'finance',
        },
      ]),
    };

    expect(findOrgChartNodeByKey(orgChartData, 7)?.headline).toBe(
      'Finance Team',
    );
    expect(findOrgChartNodeByKey(orgChartData, 99)).toBeNull();
  });
});

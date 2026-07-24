import {
    filterOrgChartNodeDataArray,
    hasActiveOrgChartGradeFilter,
    hasMeaningfulOrgChartCountryFilter,
    hasMeaningfulOrgChartFunctionRootFilter,
} from './filterOrgChartNodeDataArray';
import type { OrgChartNodeData } from './orgChartDataUtils';

const makeNode = (
  partial: Partial<OrgChartNodeData> & { key: number },
): OrgChartNodeData => ({
  headline: `Node ${partial.key}`,
  category: 'detailed',
  nodeState: 'active',
  ...partial,
});

describe('filterOrgChartNodeDataArray', () => {
  const tree: OrgChartNodeData[] = [
    makeNode({ key: 1, parent: undefined, std_function_root: 'technology' }),
    makeNode({
      key: 2,
      parent: 1,
      std_function_root: 'technology',
      country: 'India',
      allCandidates: [{ location_country: 'India' }],
    }),
    makeNode({
      key: 3,
      parent: 1,
      std_function_root: 'sales',
      country: 'United States',
      allCandidates: [{ location_country: 'United States' }],
    }),
    makeNode({
      key: 4,
      parent: 2,
      std_function_root: 'technology',
      country: 'India',
    }),
  ];

  it('detects meaningful filters', () => {
    expect(hasMeaningfulOrgChartCountryFilter('global')).toBe(false);
    expect(hasMeaningfulOrgChartCountryFilter('India')).toBe(true);
    expect(hasMeaningfulOrgChartFunctionRootFilter('fullcompany')).toBe(false);
    expect(hasMeaningfulOrgChartFunctionRootFilter('technology')).toBe(true);
  });

  it('returns the full tree when no filters apply', () => {
    const result = filterOrgChartNodeDataArray(tree, {});
    expect(result).toHaveLength(4);
  });

  it('keeps technology subtree including root ancestors', () => {
    const result = filterOrgChartNodeDataArray(tree, {
      functionRoot: 'technology',
    });
    expect(result.map((node) => node.key).sort()).toEqual([1, 2, 4]);
    const node4 = result.find((node) => node.key === 4);
    expect(node4?.parent).toBe(2);
  });

  it('keeps country matches with ancestors', () => {
    const result = filterOrgChartNodeDataArray(tree, { country: 'India' });
    expect(result.map((node) => node.key).sort()).toEqual([1, 2, 4]);
  });

  it('applies combined function and country filters on the same nodes', () => {
    const result = filterOrgChartNodeDataArray(tree, {
      functionRoot: 'technology',
      country: 'United States',
    });
    expect(result).toHaveLength(0);
  });

  it('keeps nodes matching both filters with ancestors', () => {
    const treeWithUsTech: OrgChartNodeData[] = [
      ...tree,
      makeNode({
        key: 5,
        parent: 1,
        std_function_root: 'technology',
        country: 'United States',
        allCandidates: [{ location_country: 'United States' }],
      }),
    ];
    const result = filterOrgChartNodeDataArray(treeWithUsTech, {
      functionRoot: 'technology',
      country: 'United States',
    });
    expect(result.map((node) => node.key).sort()).toEqual([1, 5]);
  });

  it('returns empty when function has no matches', () => {
    const result = filterOrgChartNodeDataArray(tree, {
      functionRoot: 'finance',
    });
    expect(result).toHaveLength(0);
  });

  it('detects active grade filters', () => {
    expect(
      hasActiveOrgChartGradeFilter({
        leadership: true,
        managers: true,
        executives: true,
      }),
    ).toBe(false);
    expect(
      hasActiveOrgChartGradeFilter({
        leadership: true,
        managers: false,
        executives: true,
      }),
    ).toBe(true);
  });

  it('filters by leadership grade tier with ancestors', () => {
    const gradedTree: OrgChartNodeData[] = [
      makeNode({
        key: 1,
        parent: undefined,
        std_grade: 'ceo',
        std_grade_category: 'senior',
      }),
      makeNode({
        key: 2,
        parent: 1,
        std_grade: 'leadership',
        std_grade_category: 'senior',
      }),
      makeNode({
        key: 3,
        parent: 2,
        std_grade: 'mid',
        std_grade_category: 'mid',
      }),
      makeNode({
        key: 4,
        parent: 3,
        std_grade: 'entry',
        std_grade_category: 'entry',
      }),
    ];

    const result = filterOrgChartNodeDataArray(gradedTree, {
      gradeVisibility: {
        leadership: true,
        managers: false,
        executives: false,
      },
    });

    expect(result.map((node) => node.key).sort()).toEqual([1, 2]);
  });

  it('filters by managers and executives tiers', () => {
    const gradedTree: OrgChartNodeData[] = [
      makeNode({
        key: 1,
        parent: undefined,
        std_grade: 'leadership',
        std_grade_category: 'senior',
      }),
      makeNode({
        key: 2,
        parent: 1,
        std_grade: 'mid',
        std_grade_category: 'mid',
      }),
      makeNode({
        key: 3,
        parent: 2,
        std_grade: 'entry',
        std_grade_category: 'entry',
      }),
    ];

    const managersOnly = filterOrgChartNodeDataArray(gradedTree, {
      gradeVisibility: {
        leadership: false,
        managers: true,
        executives: false,
      },
    });
    expect(managersOnly.map((node) => node.key).sort()).toEqual([1, 2]);

    const executivesOnly = filterOrgChartNodeDataArray(gradedTree, {
      gradeVisibility: {
        leadership: false,
        managers: false,
        executives: true,
      },
    });
    expect(executivesOnly.map((node) => node.key).sort()).toEqual([1, 2, 3]);
  });
});

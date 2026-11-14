import type { TaxonomyItem } from '../people-api.types';

export type TaxonomyTreeFunctionNode = {
  id: string;
  label: string;
};

export type TaxonomyTreeRootNode = {
  id: string;
  label: string;
  functions: TaxonomyTreeFunctionNode[];
};

export const buildTaxonomyTreeFromFlatLists = (
  functionRoots: TaxonomyItem[],
  functions: TaxonomyItem[],
): TaxonomyTreeRootNode[] => {
  const functionsByRootId = functions.reduce<
    Record<string, TaxonomyTreeFunctionNode[]>
  >((accumulator, functionItem) => {
    const parentId = (functionItem.parent_id ?? '').trim();
    if (!parentId) {
      return accumulator;
    }
    if (!accumulator[parentId]) {
      accumulator[parentId] = [];
    }
    accumulator[parentId].push({
      id: functionItem.id,
      label: functionItem.label || functionItem.name || functionItem.id,
    });
    return accumulator;
  }, {});

  return functionRoots
    .map((root) => {
      const children = [...(functionsByRootId[root.id] ?? [])].sort((left, right) =>
        left.label.localeCompare(right.label),
      );
      return {
        id: root.id,
        label: root.label || root.name || root.id,
        functions: children,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
};

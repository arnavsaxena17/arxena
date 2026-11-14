import {
  PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES,
  PEOPLE_TAXONOMY_GRADE_VALUES,
  type PeopleTaxonomyFunctionRoot,
  type PeopleTaxonomyGrade,
} from '../constants/taxonomy-constants';

import { normalizeTaxonomyLabel } from './normalize-taxonomy-label.util';

export type PeopleTaxonomyCatalogItem = {
  id: string;
  label?: string;
  name?: string;
  parent_id?: string | null;
};

export type PeopleTaxonomyFunctionItem = {
  id: string;
  label: string;
};

export const matchAllowedTaxonomyValue = <T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
): T | undefined => {
  const normalized = normalizeTaxonomyLabel(value);
  if (!normalized) {
    return undefined;
  }

  return allowedValues.find((allowedValue) => allowedValue === normalized);
};

export const matchStdGrade = (
  value: string | undefined,
): PeopleTaxonomyGrade | undefined =>
  matchAllowedTaxonomyValue(value, PEOPLE_TAXONOMY_GRADE_VALUES);

export const matchStdFunctionRoot = (
  value: string | undefined,
): PeopleTaxonomyFunctionRoot | undefined =>
  matchAllowedTaxonomyValue(value, PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES);

export const findStdFunctionCatalogMatch = (
  value: string,
  catalog: PeopleTaxonomyCatalogItem[],
): PeopleTaxonomyCatalogItem | undefined => {
  const normalized = normalizeTaxonomyLabel(value);
  if (!normalized) {
    return undefined;
  }

  return catalog.find((item) =>
    [item.id, item.label, item.name].some(
      (candidate) => normalizeTaxonomyLabel(candidate) === normalized,
    ),
  );
};

export const listStdFunctionItemsForRoot = (
  catalog: PeopleTaxonomyCatalogItem[],
  functionRoot?: string,
): PeopleTaxonomyFunctionItem[] => {
  const normalizedRoot = normalizeTaxonomyLabel(functionRoot);
  const scopedCatalog = normalizedRoot
    ? catalog.filter((item) => {
        const parentId = normalizeTaxonomyLabel(item.parent_id);
        const itemId = normalizeTaxonomyLabel(item.id);

        return parentId === normalizedRoot || itemId === normalizedRoot;
      })
    : catalog;
  const catalogToList =
    scopedCatalog.length > 0 || !normalizedRoot ? scopedCatalog : catalog;

  return [...catalogToList]
    .map((item) => ({
      id: item.id,
      label: item.label?.trim() || item.name?.trim() || item.id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
};

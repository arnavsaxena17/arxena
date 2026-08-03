import type { TitleTaxonomyClassifyResponse } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';

import { normalizeTaxonomyLabel } from './normalize-taxonomy-label.util';

export type TaxonomyFilterCriteria = {
  stdFunction?: string | null;
  stdFunctionRoot?: string | null;
  stdGrade?: string | null;
};

export type TaxonomyResolvedFields = {
  stdFunction: string | null;
  stdFunctionRoot: string | null;
  stdGrade: string | null;
  confidence: number;
};

const extractLabel = (
  item: { name?: string; id?: string } | null | undefined,
): string | null => {
  if (!item) {
    return null;
  }
  const value = item.name?.trim() || item.id?.trim();
  return value && value.length > 0 ? value : null;
};

export const classificationToResolvedFields = (
  classification: TitleTaxonomyClassifyResponse | null | undefined,
): TaxonomyResolvedFields => ({
  stdFunction: extractLabel(classification?.function),
  stdFunctionRoot: extractLabel(classification?.function_root),
  stdGrade: extractLabel(classification?.grade),
  confidence: classification?.confidence ?? 0,
});

export const matchesTaxonomyFilter = (
  resolved: TaxonomyResolvedFields,
  criteria: TaxonomyFilterCriteria,
): boolean => {
  const requestedFunction = normalizeTaxonomyLabel(criteria.stdFunction);
  const requestedRoot = normalizeTaxonomyLabel(criteria.stdFunctionRoot);
  const requestedGrade = normalizeTaxonomyLabel(criteria.stdGrade);

  if (requestedFunction) {
    if (normalizeTaxonomyLabel(resolved.stdFunction) !== requestedFunction) {
      return false;
    }
  } else if (requestedRoot) {
    if (normalizeTaxonomyLabel(resolved.stdFunctionRoot) !== requestedRoot) {
      return false;
    }
  } else {
    return false;
  }

  if (requestedGrade) {
    return normalizeTaxonomyLabel(resolved.stdGrade) === requestedGrade;
  }

  return true;
};

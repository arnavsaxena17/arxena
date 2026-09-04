import { normalizeTaxonomyLabel } from './normalize-taxonomy-label.util';

export type ManualBooleanQueryRow = {
  kind?: string;
  label?: string;
  stdGrade?: string;
  booleanQuery?: string;
  keywords?: string;
};

export type ManualBooleanQueryCriteria = {
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
};

export type ManualLinkedInQuery = {
  /** CSV `boolean_query` → Sales Nav `role.include` (current job title). */
  jobTitle?: string;
  /** CSV `keywords` → LinkedIn keywords field. */
  keywords?: string;
};

const readJobTitle = (row: ManualBooleanQueryRow): string | undefined => {
  const value = row.booleanQuery?.trim();
  return value || undefined;
};

const readKeywords = (row: ManualBooleanQueryRow): string | undefined => {
  const value = row.keywords?.trim();
  return value || undefined;
};

const toManualLinkedInQuery = (
  row: ManualBooleanQueryRow | undefined,
): ManualLinkedInQuery | undefined => {
  if (!row) {
    return undefined;
  }

  const jobTitle = readJobTitle(row);
  const keywords = readKeywords(row);
  if (!jobTitle && !keywords) {
    return undefined;
  }

  return {
    ...(jobTitle ? { jobTitle } : {}),
    ...(keywords ? { keywords } : {}),
  };
};

const isBlankGrade = (row: ManualBooleanQueryRow): boolean =>
  !(row.stdGrade ?? '').trim();

const matchesKindAndLabel = (
  row: ManualBooleanQueryRow,
  kind: string,
  label?: string,
  grade?: string,
): boolean => {
  if (normalizeTaxonomyLabel(row.kind) !== kind) {
    return false;
  }

  if (label && normalizeTaxonomyLabel(row.label) !== label) {
    return false;
  }

  if (grade && normalizeTaxonomyLabel(row.stdGrade) !== grade) {
    return false;
  }

  return true;
};

const hasCuratedText = (row: ManualBooleanQueryRow): boolean =>
  !!readJobTitle(row) || !!readKeywords(row);

export const pickManualLinkedInBooleanQuery = (
  items: ManualBooleanQueryRow[],
  criteria: ManualBooleanQueryCriteria,
): ManualLinkedInQuery | undefined => {
  if (items.length === 0) {
    return undefined;
  }

  const grade = normalizeTaxonomyLabel(criteria.stdGrade) || undefined;
  const stdFunction = normalizeTaxonomyLabel(criteria.stdFunction) || undefined;
  const stdFunctionRoot =
    normalizeTaxonomyLabel(criteria.stdFunctionRoot) || undefined;

  const withText = items.filter(hasCuratedText);

  // No grade → prefer blank-grade (any-seniority) catalog row over entry/mid/…
  if (!grade) {
    const blankByFunction = withText.find(
      (row) =>
        isBlankGrade(row) &&
        matchesKindAndLabel(row, 'std_function', stdFunction),
    );
    if (blankByFunction) {
      return toManualLinkedInQuery(blankByFunction);
    }

    const blankByRoot = withText.find(
      (row) =>
        isBlankGrade(row) &&
        matchesKindAndLabel(row, 'std_function_root', stdFunctionRoot),
    );
    if (blankByRoot) {
      return toManualLinkedInQuery(blankByRoot);
    }
  }

  const byFunction = withText.find((row) =>
    matchesKindAndLabel(row, 'std_function', stdFunction, grade),
  );
  if (byFunction) {
    return toManualLinkedInQuery(byFunction);
  }

  const byRoot = withText.find((row) =>
    matchesKindAndLabel(row, 'std_function_root', stdFunctionRoot, grade),
  );
  if (byRoot) {
    return toManualLinkedInQuery(byRoot);
  }

  return toManualLinkedInQuery(withText[0] ?? items[0]);
};

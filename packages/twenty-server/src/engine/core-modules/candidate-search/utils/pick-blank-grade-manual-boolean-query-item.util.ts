import type { TitleTaxonomyManualBooleanQueryItem } from '../services/title-taxonomy-remote.service';

const isBlankStdGrade = (stdGrade: string | null | undefined): boolean =>
  !(stdGrade ?? '').trim();

/**
 * Pure function-root org-chart searches use the blank-grade CSV row
 * (empty std_grade = any seniority). The taxonomy list endpoint returns all
 * grades when std_grade is omitted, and entry is usually first — prefer blank.
 */
export const pickBlankGradeManualBooleanQueryItem = (
  items: TitleTaxonomyManualBooleanQueryItem[] | undefined,
): TitleTaxonomyManualBooleanQueryItem | undefined => {
  if (!items?.length) {
    return undefined;
  }

  const blankGradeRow = items.find((item) => isBlankStdGrade(item.std_grade));
  return blankGradeRow ?? items[0];
};

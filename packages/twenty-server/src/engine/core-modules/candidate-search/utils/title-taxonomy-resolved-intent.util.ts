import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import type { OrgChartParsed } from '../schemas/org-chart.schema';

/**
 * Maps unified BD LLM output + merged org-chart filters to arxena-site
 * POST /api/title-taxonomy/search-keywords `resolved_intent` body.
 *
 * Axes:
 * - Grade keyword expansion only when `std_grade_levels` is non-empty (user explicitly mentioned levels).
 * - Function truth-table expansion from BooleanStandardize when `merge_boolean_standardize_for_functions`
 *   is true (role text and/or function roots present; off for pure grade-only intent without role text).
 * - Never copy `business_division` into `role_description` (avoids treating division words as job titles).
 * - Do not send `division_or_department` to title taxonomy: division synonyms stay in `business_division_keywords`
 *   only; the Python service otherwise ANDs a duplicate division modifier onto the function expansion.
 */
export function buildTitleTaxonomyResolvedIntent(args: {
  companyName: string;
  parsed: OrgChartParsed;
  effectiveFunctionRoot: string;
}): Record<string, unknown> {
  const { companyName, parsed, effectiveFunctionRoot } = args;
  const roleText = (parsed.role_description ?? '').trim();

  const explicitGradeLevels = (parsed.std_grade_levels ?? [])
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

  const hasMeaningfulFunction =
    hasMeaningfulOrgChartFunctionRootFilter(effectiveFunctionRoot) ||
    !!(parsed.function_root ?? '').trim();

  const hasExplicitGrades = explicitGradeLevels.length > 0;

  /** Explicit grades, no UI/function root, and no role phrase — seniority-only keyword expansion. */
  const isGradeOnlyIntent =
    hasExplicitGrades && !hasMeaningfulFunction && roleText.length === 0;

  const mergeBooleanStandardizeForGrades = false;

  let mergeBooleanStandardizeForFunctions = true;
  if (isGradeOnlyIntent) {
    mergeBooleanStandardizeForFunctions = false;
  }
  if (!roleText && !hasMeaningfulFunction && !hasExplicitGrades) {
    mergeBooleanStandardizeForFunctions = false;
  }

  const stdGradeLevelsOut = hasExplicitGrades ? explicitGradeLevels : [];

  const roots: string[] = [];
  if (!isGradeOnlyIntent) {
    const fnRoot = effectiveFunctionRoot.trim().toLowerCase();
    if (hasMeaningfulOrgChartFunctionRootFilter(effectiveFunctionRoot)) {
      roots.push(fnRoot);
    } else if ((parsed.function_root ?? '').trim()) {
      roots.push(parsed.function_root!.trim());
    }
  }

  const out: Record<string, unknown> = {
    company_name: companyName,
    scope: 'single_role',
    merge_boolean_standardize_for_grades: mergeBooleanStandardizeForGrades,
    merge_boolean_standardize_for_functions:
      mergeBooleanStandardizeForFunctions,
    std_grade_levels: stdGradeLevelsOut,
  };

  if (roleText.length > 0) {
    out.role_description = roleText;
  }

  if (roots.length > 0) {
    out.std_function_roots = roots;
  }

  return out;
}

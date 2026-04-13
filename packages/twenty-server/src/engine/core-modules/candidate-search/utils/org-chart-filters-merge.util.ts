import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import {
  normalizeLlmNullishString,
  type OrgChartParsed,
} from '../schemas/org-chart.schema';

export type MergedOrgChartFilters = {
  /** Raw country string for request/LinkedIn (empty = global) */
  effectiveCountryRaw: string;
  /** Normalized for org-chart cache keys (e.g. global) */
  effectiveCountryNormalized: string;
  effectiveFunctionRoot: string;
  /** LLM + merge: keywords that constrain the search to the named business division only. */
  businessDivisionKeywords: string;
};

/**
 * Merge LLM output with UI defaults.
 * - Country: parsed from NL wins; else UI unless UI is global/empty.
 * - Function: parsed wins; else meaningful UI function root; else empty (full company).
 */
export function mergeFilters(
  parsed: OrgChartParsed,
  defaultCountryRaw: string,
  defaultFunctionRootRaw: string,
): MergedOrgChartFilters {
  const businessDivisionKeywords = parsed.business_division_keywords?.trim() ?? '';
  const parsedCountry = normalizeLlmNullishString(parsed.country) ?? '';
  const parsedFn =
    normalizeLlmNullishString(parsed.function_root) ?? '';
  const uiCountry = defaultCountryRaw.trim();
  const uiFn = defaultFunctionRootRaw.trim();

  let effectiveCountryRaw = '';
  if (parsedCountry.length > 0) {
    effectiveCountryRaw =
      parsedCountry.toLowerCase() === 'global' ? '' : parsedCountry;
  } else if (uiCountry.length > 0 && uiCountry.toLowerCase() !== 'global') {
    effectiveCountryRaw = uiCountry;
  }

  let effectiveFunctionRoot = '';
  if (parsedFn.length > 0) {
    effectiveFunctionRoot = parsedFn;
  } else if (hasMeaningfulOrgChartFunctionRootFilter(uiFn)) {
    effectiveFunctionRoot = uiFn;
  }

  const effectiveCountryNormalized =
    !effectiveCountryRaw || effectiveCountryRaw.toLowerCase() === 'global'
      ? 'global'
      : effectiveCountryRaw.toLowerCase().replace(/\s+/g, '_');

  return {
    effectiveCountryRaw,
    effectiveCountryNormalized,
    effectiveFunctionRoot,
    businessDivisionKeywords,
  };
}

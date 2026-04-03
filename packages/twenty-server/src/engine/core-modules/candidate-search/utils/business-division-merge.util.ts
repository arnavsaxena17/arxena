import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import type { BusinessDivisionOrgChartParsed } from '../schemas/business-division-org-chart.schema';

export type MergedBusinessDivisionFilters = {
  /** Raw country string for request/LinkedIn (empty = global) */
  effectiveCountryRaw: string;
  /** Normalized for org-chart cache keys (e.g. global) */
  effectiveCountryNormalized: string;
  effectiveFunctionRoot: string;
  linkedinKeywords: string;
};

/**
 * Merge LLM output with UI defaults.
 * - Country: parsed from NL wins; else UI unless UI is global/empty.
 * - Function: parsed wins; else meaningful UI function root; else empty (full company).
 */
export function mergeBusinessDivisionFilters(
  parsed: BusinessDivisionOrgChartParsed,
  defaultCountryRaw: string,
  defaultFunctionRootRaw: string,
): MergedBusinessDivisionFilters {
  const linkedinKeywords = parsed.linkedin_keywords?.trim() ?? '';
  const parsedCountry = parsed.country?.trim() ?? '';
  const parsedFn = parsed.function_root?.trim() ?? '';
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
    linkedinKeywords,
  };
}

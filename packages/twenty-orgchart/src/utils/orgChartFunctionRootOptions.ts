import { toTitleCase } from 'twenty-shared/utils';

import { BLANK_ORG_CHART_PREVIEW_FUNCTION_ROOTS } from '../constants/blankOrgChartPreviewFunctionRoots';
import { sortOrgChartFunctionRootKeys } from './orgChartFilterDropdownSort';

const isValidFunctionRootOption = (fn: string): boolean =>
  fn.trim().length > 0 && !fn.toLowerCase().includes('assist');

export const formatOrgChartFunctionRootOptionLabel = (
  key: string,
  percentLabels: Record<string, string>,
  countMap: Record<string, number> | undefined,
): string => {
  const title = toTitleCase(key);
  const pct = percentLabels[key];
  const count = countMap?.[key];
  const parts: string[] = [title];
  if (typeof count === 'number' && count > 0) {
    parts.push(`${count.toLocaleString()} people`);
  }
  if (pct) {
    parts.push(pct);
  }
  return parts.join(' · ');
};

export const mergeBlankPreviewFunctionRoots = (
  functionRoots: string[],
  options?: {
    isBlankTemplate?: boolean;
    /** Super Impose scope filters — offer all standard roots even when the chart is partial. */
    includePreviewFunctionRoots?: boolean;
  },
): string[] => {
  const shouldMerge =
    options?.isBlankTemplate === true ||
    options?.includePreviewFunctionRoots === true;

  if (!shouldMerge) {
    return functionRoots;
  }

  return sortOrgChartFunctionRootKeys(
    [
      ...functionRoots,
      ...BLANK_ORG_CHART_PREVIEW_FUNCTION_ROOTS,
      'fullcompany',
    ],
    {},
  );
};

export const buildVisibleFunctionRoots = (args: {
  availableFunctionRoots: string[];
  functionRootPercentLabels: Record<string, string>;
  selectedFunctionRoot?: string;
  isBlankTemplate?: boolean;
  includePreviewFunctionRoots?: boolean;
  includeFullCompany?: boolean;
}): string[] => {
  const merged = mergeBlankPreviewFunctionRoots(args.availableFunctionRoots, {
    isBlankTemplate: args.isBlankTemplate,
    includePreviewFunctionRoots: args.includePreviewFunctionRoots,
  });

  const base = merged.filter((fn) => {
    if (!isValidFunctionRootOption(fn)) {
      return false;
    }
    if (args.includeFullCompany === false && fn === 'fullcompany') {
      return false;
    }
    return true;
  });

  if (!args.selectedFunctionRoot) {
    return base;
  }

  if (base.includes(args.selectedFunctionRoot)) {
    return base;
  }

  if (!isValidFunctionRootOption(args.selectedFunctionRoot)) {
    return base;
  }

  return sortOrgChartFunctionRootKeys(
    [...base, args.selectedFunctionRoot],
    args.functionRootPercentLabels,
  );
};

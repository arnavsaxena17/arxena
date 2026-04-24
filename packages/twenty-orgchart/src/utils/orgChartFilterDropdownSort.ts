const percentFromLabel = (label: string | undefined): number => {
  if (!label) return -1;
  const n = parseFloat(label.replace('%', ''));
  return Number.isFinite(n) ? n : -1;
};

/** Global first; remaining keys by percent label descending; tie-breaker A–Z. */
export const sortOrgChartCountryKeys = (
  keys: Iterable<string>,
  countryPercentLabels: Record<string, string>,
): string[] =>
  Array.from(new Set(keys)).sort((a, b) => {
    if (a === 'global') return -1;
    if (b === 'global') return 1;
    const diff =
      percentFromLabel(countryPercentLabels[b]) -
      percentFromLabel(countryPercentLabels[a]);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

/** Full company first; remaining keys by percent label descending; tie-breaker A–Z. */
export const sortOrgChartFunctionRootKeys = (
  keys: Iterable<string>,
  functionRootPercentLabels: Record<string, string>,
): string[] =>
  Array.from(new Set(keys)).sort((a, b) => {
    if (a === 'fullcompany') return -1;
    if (b === 'fullcompany') return 1;
    const diff =
      percentFromLabel(functionRootPercentLabels[b]) -
      percentFromLabel(functionRootPercentLabels[a]);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

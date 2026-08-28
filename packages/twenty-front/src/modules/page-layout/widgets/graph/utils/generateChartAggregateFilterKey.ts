export const generateChartAggregateFilterKey = (
  rangeMin?: number | null,
  rangeMax?: number | null,
  omitNullValues?: boolean | null,
  gtmDashboardProjectScopeKey?: string | null,
): string => {
  return `${rangeMin ?? ''}-${rangeMax ?? ''}-${omitNullValues ?? ''}-${gtmDashboardProjectScopeKey ?? 'all-projects'}`;
};

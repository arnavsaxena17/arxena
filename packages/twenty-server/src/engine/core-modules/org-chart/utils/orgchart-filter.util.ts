export const normalizeOrgChartFunctionRootFilter = (
  functionRoot?: string,
): string => {
  return (functionRoot ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
};

export const hasMeaningfulOrgChartFunctionRootFilter = (
  functionRoot?: string,
): boolean => {
  const normalized = normalizeOrgChartFunctionRootFilter(functionRoot);

  return normalized.length > 0 && normalized !== 'fullcompany';
};

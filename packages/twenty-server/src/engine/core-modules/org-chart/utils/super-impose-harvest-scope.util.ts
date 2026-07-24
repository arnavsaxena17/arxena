/** Harvest lead-search functionIds — subset of LinkedIn function facet IDs. */
const HARVEST_FUNCTION_ROOT_TO_IDS: Record<string, string> = {
  sales: '25',
  engineering: '8',
  humanresources: '12',
  marketing: '15',
  finance: '10',
  operations: '18',
  productmanagement: '19',
  research: '24',
  informationtechnology: '13',
  customerservice: '26',
  design: '3',
  legal: '14',
  consulting: '6',
  education: '9',
  administrative: '2',
};

export const resolveHarvestFunctionIdsForFunctionRoot = (
  functionRoot?: string,
): string | undefined => {
  const normalized = (functionRoot ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  if (!normalized || normalized === 'fullcompany') {
    return undefined;
  }

  return HARVEST_FUNCTION_ROOT_TO_IDS[normalized];
};

export const resolveHarvestLocationForCountry = (
  country?: string,
): string | undefined => {
  const normalized = (country ?? '').trim();
  if (!normalized || normalized.toLowerCase() === 'global') {
    return undefined;
  }

  return normalized;
};

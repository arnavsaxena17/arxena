import { resolveSalesNavFunctionIdsForRoot } from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';

/** Harvest lead-search functionIds — Sales Nav function facet IDs. */
export const resolveHarvestFunctionIdsForFunctionRoot = (
  functionRoot?: string,
): string | undefined => resolveSalesNavFunctionIdsForRoot(functionRoot);

export const resolveHarvestLocationForCountry = (
  country?: string,
): string | undefined => {
  const normalized = (country ?? '').trim();
  if (!normalized || normalized.toLowerCase() === 'global') {
    return undefined;
  }

  return normalized;
};

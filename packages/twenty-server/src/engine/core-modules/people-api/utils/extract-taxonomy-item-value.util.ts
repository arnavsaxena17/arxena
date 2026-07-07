import type { TaxonomyItem } from '../people-api.types';

export const extractTaxonomyItemValue = (
  item: TaxonomyItem | null | undefined,
): string | null => {
  if (!item) {
    return null;
  }
  const value = item.name?.trim() || item.id?.trim();
  return value.length > 0 ? value : null;
};

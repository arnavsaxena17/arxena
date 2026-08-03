export const normalizeTaxonomyLabel = (
  value: string | null | undefined,
): string =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

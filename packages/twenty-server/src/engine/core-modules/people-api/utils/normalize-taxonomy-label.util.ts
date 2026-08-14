export const normalizeTaxonomyLabel = (
  value: string | null | undefined,
): string =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const toOptionalNormalizedTaxonomyLabel = ({
  value,
}: {
  value: unknown;
}) => {
  if (typeof value !== 'string') {
    return value;
  }

  return normalizeTaxonomyLabel(value) || undefined;
};

export const GTM_ICP_CHIP_FIELDS = [
  { key: 'industries', label: 'Industries' },
  { key: 'geos', label: 'Locations' },
  { key: 'buyerTitles', label: 'Buyer titles' },
  { key: 'painSignals', label: 'Pain signals' },
  { key: 'stdFunctions', label: 'Functions' },
  { key: 'stdGrades', label: 'Grades' },
] as const;

export type GtmIcpChipFieldKey = (typeof GTM_ICP_CHIP_FIELDS)[number]['key'];

export const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const parseIcpSpecObject = (
  icpSpec: string,
): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(icpSpec);

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const readIcpChipValues = (
  icpSpec: string,
  key: GtmIcpChipFieldKey,
): string[] => {
  const parsed = parseIcpSpecObject(icpSpec);

  if (parsed === null) {
    return [];
  }

  return toStringList(parsed[key]);
};

export const writeIcpChipValues = (
  icpSpec: string,
  key: GtmIcpChipFieldKey,
  values: string[],
): string => {
  const parsed = parseIcpSpecObject(icpSpec) ?? {};

  parsed[key] = values;

  return JSON.stringify(parsed, null, 2);
};

export const readIcpStringField = (icpSpec: string, key: string): string => {
  const parsed = parseIcpSpecObject(icpSpec);
  const value = parsed?.[key];

  return typeof value === 'string' ? value : '';
};

export const writeIcpStringField = (
  icpSpec: string,
  key: string,
  value: string,
): string => {
  const parsed = parseIcpSpecObject(icpSpec) ?? {};

  parsed[key] = value;

  return JSON.stringify(parsed, null, 2);
};

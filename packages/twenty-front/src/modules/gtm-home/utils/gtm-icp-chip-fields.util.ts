export const GTM_ICP_CHIP_FIELDS = [
  { key: 'buyerTitles', label: 'Buyer titles' },
  { key: 'locations', label: 'Locations' },
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

const slimIcpRecord = (
  parsed: Record<string, unknown>,
): Record<string, unknown> => {
  const locations = [
    ...toStringList(parsed.locations),
    ...toStringList(parsed.geos),
  ];

  return {
    buyerTitles: toStringList(parsed.buyerTitles),
    locations: [...new Set(locations)],
  };
};

export const readIcpChipValues = (
  icpSpec: string,
  key: GtmIcpChipFieldKey,
): string[] => {
  const parsed = parseIcpSpecObject(icpSpec);

  if (parsed === null) {
    return [];
  }

  return toStringList(slimIcpRecord(parsed)[key]);
};

export const writeIcpChipValues = (
  icpSpec: string,
  key: GtmIcpChipFieldKey,
  values: string[],
): string => {
  const parsed = slimIcpRecord(parseIcpSpecObject(icpSpec) ?? {});

  parsed[key] = values;

  return JSON.stringify(parsed, null, 2);
};


const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export type GtmIcpSpec = {
  buyerTitles: string[];
  locations: string[];
};

export const EMPTY_GTM_ICP_SPEC: GtmIcpSpec = {
  buyerTitles: [],
  locations: [],
};

export const normalizeGtmIcpSpec = (value: unknown): GtmIcpSpec => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_GTM_ICP_SPEC };
  }

  const record = value as Record<string, unknown>;
  const locations = [
    ...toStringList(record.locations),
    ...toStringList(record.geos),
  ];

  return {
    buyerTitles: toStringList(record.buyerTitles),
    locations: [...new Set(locations)],
  };
};

export const parseGtmIcpSpec = (
  raw: string | null | undefined,
): GtmIcpSpec => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ...EMPTY_GTM_ICP_SPEC };
  }

  try {
    return normalizeGtmIcpSpec(JSON.parse(raw));
  } catch {
    return { ...EMPTY_GTM_ICP_SPEC };
  }
};

export const stringifyGtmIcpSpec = (spec: GtmIcpSpec): string =>
  JSON.stringify(normalizeGtmIcpSpec(spec));

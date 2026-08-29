const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export type IcpSpec = {
  buyerTitles: string[];
  locations: string[];
};

export const EMPTY_ICP_SPEC: IcpSpec = {
  buyerTitles: [],
  locations: [],
};

export const normalizeIcpSpec = (value: unknown): IcpSpec => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_ICP_SPEC };
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

export const parseIcpSpec = (
  raw: string | null | undefined,
): IcpSpec => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ...EMPTY_ICP_SPEC };
  }

  try {
    return normalizeIcpSpec(JSON.parse(raw));
  } catch {
    return { ...EMPTY_ICP_SPEC };
  }
};

export const stringifyIcpSpec = (spec: IcpSpec): string =>
  JSON.stringify(normalizeIcpSpec(spec));

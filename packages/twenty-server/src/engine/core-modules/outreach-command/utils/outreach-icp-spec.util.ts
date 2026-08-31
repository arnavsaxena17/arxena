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
  targetTitles: string[];
  locations: string[];
};

export const EMPTY_ICP_SPEC: IcpSpec = {
  targetTitles: [],
  locations: [],
};

const readTargetTitles = (record: Record<string, unknown>): string[] => {
  const targetTitles = toStringList(record.targetTitles);

  if (targetTitles.length > 0) {
    return targetTitles;
  }

  return toStringList(record.buyerTitles);
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
    targetTitles: readTargetTitles(record),
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

export const renameBuyerTitlesKeyInIcpSpecJson = (
  raw: string,
): { next: string; changed: boolean } => {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return { next: raw, changed: false };
    }

    const record = parsed as Record<string, unknown>;

    if (!('buyerTitles' in record)) {
      return { next: raw, changed: false };
    }

    const { buyerTitles: _removedBuyerTitles, ...rest } = record;
    const nextRecord = {
      ...rest,
      targetTitles: readTargetTitles(record),
    };

    return { next: JSON.stringify(nextRecord), changed: true };
  } catch {
    return { next: raw, changed: false };
  }
};

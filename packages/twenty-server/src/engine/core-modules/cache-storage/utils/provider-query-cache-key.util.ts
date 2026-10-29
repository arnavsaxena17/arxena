import { createHash } from 'crypto';

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      const nested = record[key];

      if (nested === undefined) {
        continue;
      }

      sorted[key] = sortValue(nested);
    }

    return sorted;
  }

  return value;
};

export const stableStringifyProviderQueryCacheValue = (
  value: unknown,
): string => JSON.stringify(sortValue(value));

export const buildProviderQueryCacheKey = (
  prefix: string,
  parts: unknown,
): string => {
  const digest = createHash('sha256')
    .update(stableStringifyProviderQueryCacheValue(parts))
    .digest('hex');

  return `${prefix}:${digest}`;
};

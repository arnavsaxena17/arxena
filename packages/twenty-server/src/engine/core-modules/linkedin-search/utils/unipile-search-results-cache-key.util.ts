import { createHash } from 'crypto';

export const UNIPILE_SEARCH_RESULTS_CACHE_KEY_PREFIX = 'unipile-search:v1';

export type UnipileSearchResultsCacheKeyInput = {
  accountId: string;
  searchRequest: unknown;
  cursor?: string;
  limit?: number;
};

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

export const stableStringifyUnipileSearchCacheValue = (
  value: unknown,
): string => JSON.stringify(sortValue(value));

export const buildUnipileSearchResultsCacheKey = (
  input: UnipileSearchResultsCacheKeyInput,
): string => {
  const payload = stableStringifyUnipileSearchCacheValue({
    searchRequest: input.searchRequest,
    cursor: input.cursor?.trim() || undefined,
    limit: input.limit,
  });
  const digest = createHash('sha256').update(payload).digest('hex');

  return `${UNIPILE_SEARCH_RESULTS_CACHE_KEY_PREFIX}:${input.accountId.trim()}:${digest}`;
};

import { isNonEmptyString } from '@sniptt/guards';

import { type CompanyNewsItem } from 'src/engine/core-modules/org-chart/schemas/company-news.schema';

// Outreach openers should only cite recent company news — not stale stories.
export const COMPANY_NEWS_ITEM_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const RELATIVE_AGE_PATTERN =
  /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i;

const UNIT_TO_MS: Record<string, number> = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

// Best-effort parse of SERP / LLM news dates. Returns null when unknown.
export const parseCompanyNewsItemDateMs = (
  rawDate: string,
  nowMs: number = Date.now(),
): number | null => {
  const trimmed = rawDate.trim();

  if (!isNonEmptyString(trimmed) || trimmed.toLowerCase() === 'unknown') {
    return null;
  }

  const relativeMatch = trimmed.match(RELATIVE_AGE_PATTERN);

  if (
    isNonEmptyString(relativeMatch?.[1]) &&
    isNonEmptyString(relativeMatch?.[2])
  ) {
    const amount = Number(relativeMatch[1]);
    const unitMs = UNIT_TO_MS[relativeMatch[2].toLowerCase()];

    if (Number.isFinite(amount) && typeof unitMs === 'number') {
      return nowMs - amount * unitMs;
    }
  }

  const parsed = Date.parse(trimmed);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return null;
};

export const isRecentCompanyNewsItem = (
  item: Pick<CompanyNewsItem, 'date'>,
  {
    nowMs = Date.now(),
    maxAgeMs = COMPANY_NEWS_ITEM_MAX_AGE_MS,
  }: {
    nowMs?: number;
    maxAgeMs?: number;
  } = {},
): boolean => {
  const publishedMs = parseCompanyNewsItemDateMs(item.date, nowMs);

  if (publishedMs === null) {
    return false;
  }

  return nowMs - publishedMs <= maxAgeMs;
};

export const filterRecentCompanyNewsItems = <
  TItem extends Pick<CompanyNewsItem, 'date'>,
>(
  items: TItem[],
  options?: {
    nowMs?: number;
    maxAgeMs?: number;
  },
): TItem[] => items.filter((item) => isRecentCompanyNewsItem(item, options));

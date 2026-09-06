import { isNonEmptyString } from '@sniptt/guards';

import { type BrightDataSerpOrganicEntry } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';

export const DEFAULT_GOOGLE_SERP_RESULT_LIMIT = 8;
export const MAX_GOOGLE_SERP_RESULT_LIMIT = 10;

export type GoogleSerpOrganicItem = {
  title: string;
  url: string;
  snippet?: string;
  rank?: number;
};

export const resolveGoogleSerpResultLimit = (limit?: number): number => {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_GOOGLE_SERP_RESULT_LIMIT;
  }

  return Math.min(MAX_GOOGLE_SERP_RESULT_LIMIT, Math.floor(limit));
};

export const buildGoogleSerpSearchUrl = (
  query: string,
  limit: number,
): string => {
  const searchParams = new URLSearchParams({
    q: query,
    hl: 'en',
    num: String(limit),
  });

  return `https://www.google.com/search?${searchParams.toString()}`;
};

export const mapGoogleSerpOrganicResults = (
  organic: BrightDataSerpOrganicEntry[] | undefined,
  limit: number,
): GoogleSerpOrganicItem[] => {
  if (!Array.isArray(organic)) {
    return [];
  }

  const items: GoogleSerpOrganicItem[] = [];

  for (const entry of organic) {
    const url = (entry.link ?? entry.url ?? '').trim();
    const title = (entry.title ?? '').trim();

    if (!isNonEmptyString(url) || !isNonEmptyString(title)) {
      continue;
    }

    const snippet = (entry.description ?? '').trim();
    const rank = entry.global_rank ?? entry.rank;
    const item: GoogleSerpOrganicItem = { title, url };

    if (isNonEmptyString(snippet)) {
      item.snippet = snippet;
    }

    if (typeof rank === 'number' && Number.isFinite(rank)) {
      item.rank = rank;
    }

    items.push(item);

    if (items.length >= limit) {
      break;
    }
  }

  return items;
};

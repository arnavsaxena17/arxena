import { isNonEmptyString } from '@sniptt/guards';

import { type BrightDataSerpOrganicEntry } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';

export const DEFAULT_GOOGLE_SERP_RESULT_LIMIT = 8;
export const MAX_GOOGLE_SERP_RESULT_LIMIT = 10;

export type GoogleSerpOrganicItem = {
  title: string;
  url: string;
  snippet?: string;
  rank?: number;
  // Fields Bright Data's parser lifted out of the result, e.g. a LinkedIn
  // result's location, role and company
  extensions?: string[];
};

export const resolveGoogleSerpResultLimit = (limit?: number): number => {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_GOOGLE_SERP_RESULT_LIMIT;
  }

  return Math.min(MAX_GOOGLE_SERP_RESULT_LIMIT, Math.floor(limit));
};

export type GoogleSerpSearchUrlOptions = {
  // Google market ("in", "ae", "us"). Without it Bright Data's egress country
  // decides the market, which changes per request, so the same query can be
  // answered with a different country's results each time.
  country?: string;
  // Ask Bright Data for Google's AI Overview. It is slower (~5-10 s) and only
  // some queries return one, so callers opt in per query, not per run.
  aiOverview?: boolean;
  // The AI Overview zone answers with parsed JSON only when brd_json=1 is on
  // the Google URL; the normal SERP API route sets the format in the body
  brdJson?: boolean;
};

export const buildGoogleSerpSearchUrl = (
  query: string,
  limit: number,
  options: GoogleSerpSearchUrlOptions = {},
): string => {
  const searchParams = new URLSearchParams({
    q: query,
    hl: 'en',
    num: String(limit),
  });

  if (isNonEmptyString(options.country)) {
    searchParams.set('gl', options.country);
  }

  if (options.aiOverview === true) {
    searchParams.set('brd_ai_overview', '2');
  }

  if (options.brdJson === true) {
    searchParams.set('brd_json', '1');
  }

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

    const extensions = (entry.extensions ?? [])
      .map((extension) => (extension.text ?? '').trim())
      .filter(isNonEmptyString);

    if (extensions.length > 0) {
      item.extensions = extensions;
    }

    items.push(item);

    if (items.length >= limit) {
      break;
    }
  }

  return items;
};

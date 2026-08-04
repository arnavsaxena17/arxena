import { JSDOM } from 'jsdom';

import type {
  BuiltWithAiIndex,
  BuiltWithDetailedTechnology,
  BuiltWithProfileMeta,
  BuiltWithTechnology,
  BuiltWithTechnologyCategory,
} from 'src/engine/core-modules/builtwith/types/builtwith.types';

const PROFILE_META_CARD_HEADERS = new Set([
  'profile details',
  'detailed profile',
  'ai index',
  'site age',
  'browser extension',
  'notifications',
  'builtwith top site rank',
  'technology spend',
  'technology filter',
  'upgrade to builtwith advanced',
]);

const stripHtml = (value: string): string =>
  value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const parseTitle = (document: Document): string | null =>
  document.title?.trim() || null;

const parseLiveTechnologiesCount = (html: string): number | null => {
  const match = html.match(/(\d+)\s+live technologies/i);

  return match?.[1] ? Number(match[1]) : null;
};

const parseLastTechnologyDetected = (html: string): string | null => {
  const match = html.match(
    /Last technology detected on\s+([^.<]+)\./i,
  );

  return match?.[1]?.trim() || null;
};

const parseSiteAgeLabel = (html: string): string | null => {
  const match = html.match(
    /First registered at least\s+([^.<]+)\./i,
  );

  return match?.[1]?.trim() || null;
};

const parseTopSiteRank = (html: string): number | null => {
  const match = html.match(
    /ranked\s+([\d,]+)(?:st|nd|rd|th)/i,
  );

  if (!match?.[1]) {
    return null;
  }

  return Number(match[1].replace(/,/g, ''));
};

const parseAiIndex = (html: string): BuiltWithAiIndex => {
  const scoreMatch = html.match(
    /AI Index[\s\S]{0,400}?<h4[^>]*>\s*(\d+\s*\/\s*100)/i,
  );
  const labelMatch = html.match(
    /AI Index[\s\S]{0,500}?<span class="badge[^"]*"[^>]*>\s*([^<]+)\s*<\/span>/i,
  );

  return {
    score: scoreMatch?.[1]?.replace(/\s+/g, '') || null,
    label: labelMatch?.[1]?.trim() || null,
  };
};

const parseTechnologySpend = (html: string): string | null => {
  const match = html.match(
    /Technology Spend[\s\S]{0,300}?<h4[^>]*>\s*([^<]+)/i,
  );

  return match?.[1]?.trim() || null;
};

export const parseBuiltWithProfileMeta = (
  profileHtml: string,
  detailedHtml?: string | null,
): BuiltWithProfileMeta => ({
  liveTechnologiesCount: parseLiveTechnologiesCount(profileHtml),
  lastTechnologyDetected: parseLastTechnologyDetected(profileHtml),
  siteAgeLabel: parseSiteAgeLabel(profileHtml),
  topSiteRank: parseTopSiteRank(profileHtml),
  aiIndex: parseAiIndex(profileHtml),
  technologySpend: parseTechnologySpend(detailedHtml ?? profileHtml),
});

export const parseBuiltWithProfileCategories = (
  profileHtml: string,
): BuiltWithTechnologyCategory[] => {
  const cards = profileHtml.split(/<div class="card mb-4">/i);
  const categories: BuiltWithTechnologyCategory[] = [];

  for (const card of cards.slice(1)) {
    const headerMatch = card.match(
      /<div class="card-header[^"]*"[^>]*>\s*<div class="row">\s*<div class="col-6">([^<]+)<\/div>/i,
    );

    if (!headerMatch) {
      continue;
    }

    const category = headerMatch[1].trim();

    if (PROFILE_META_CARD_HEADERS.has(category.toLowerCase())) {
      continue;
    }

    const titleMatches = [
      ...card.matchAll(
        /<h2 class="widget-title"><a href="\/\/trends\.builtwith\.com\/([^"/]+)\/([^"]+)"[^>]*>([^<]+)<\/a><\/h2>/gi,
      ),
    ];
    const technologies: BuiltWithTechnology[] = titleMatches.map(
      (titleMatch) => {
        const chunk = card.slice(
          titleMatch.index ?? 0,
          (titleMatch.index ?? 0) + 1_200,
        );
        const descriptionMatch = chunk.match(
          /<p class="widget-description[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
        );
        const tags = [
          ...chunk.matchAll(/class="text-black-50">([^<]+)<\/a>/gi),
        ].map((tagMatch) => tagMatch[1].trim());

        return {
          name: titleMatch[3].trim(),
          slug: titleMatch[2].trim(),
          trendCategory: titleMatch[1].trim(),
          description: descriptionMatch
            ? stripHtml(descriptionMatch[1]) || null
            : null,
          tags,
        };
      },
    );

    if (technologies.length > 0) {
      categories.push({ category, technologies });
    }
  }

  return categories;
};

export const parseBuiltWithDetailedTechnologies = (
  detailedHtml: string,
): BuiltWithDetailedTechnology[] => {
  const rowMatches = [
    ...detailedHtml.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi),
  ];
  const technologies: BuiltWithDetailedTechnology[] = [];
  let currentCategory: string | null = null;

  for (const rowMatch of rowMatches) {
    const attributes = rowMatch[1] ?? '';
    const body = rowMatch[2] ?? '';
    const categoryMatch = body.match(
      /<td[^>]*colspan="4"[^>]*>\s*<b>([^<]+)<\/b>/i,
    );

    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    if (!currentCategory) {
      continue;
    }

    const technologyMatch = body.match(
      /href="\/\/trends\.builtwith\.com\/([^"/]+)\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
    );

    if (!technologyMatch) {
      continue;
    }

    const dataTypesMatch = attributes.match(/data-types="([^"]*)"/i);
    const dataTypes = dataTypesMatch?.[1]
      ? dataTypesMatch[1].split(/\s+/).filter(Boolean)
      : [];
    const dates = [
      ...body.matchAll(/<td>([A-Z][a-z]{2} \d{4})<\/td>/g),
    ].map((match) => match[1]);
    const isHistorical =
      /\bhist\b/i.test(attributes) || dataTypes.includes('hist');

    technologies.push({
      category: currentCategory,
      name: technologyMatch[3].trim(),
      slug: technologyMatch[2].trim(),
      trendCategory: technologyMatch[1].trim(),
      firstDetected: dates[0] ?? null,
      lastDetected: dates[1] ?? null,
      isHistorical,
      dataTypes,
    });
  }

  return technologies;
};

export const isBuiltWithChallengeOrEmptyPage = (html: string): boolean => {
  const normalized = html.slice(0, 2_000).toLowerCase();

  return (
    /just a moment|cf-mitigated|enable javascript and cookies to continue/i.test(
      normalized,
    ) ||
    (/loading/i.test(normalized) &&
      !/technology profile|detailed technology profile/i.test(html.slice(0, 5_000)))
  );
};

export const isBuiltWithNotFoundPage = (html: string): boolean => {
  const document = new JSDOM(html).window.document;
  const title = document.title?.toLowerCase() ?? '';
  const bodyText = document.body?.textContent?.slice(0, 1_000).toLowerCase() ?? '';

  return (
    /404 not found/i.test(title) ||
    /page not found|could not find|no results found|doesn't look like a website/i.test(
      `${title} ${bodyText}`,
    )
  );
};

export const parseBuiltWithProfilePage = (
  profileHtml: string,
): {
  title: string | null;
  meta: BuiltWithProfileMeta;
  categories: BuiltWithTechnologyCategory[];
} => {
  const document = new JSDOM(profileHtml).window.document;

  return {
    title: parseTitle(document),
    meta: parseBuiltWithProfileMeta(profileHtml),
    categories: parseBuiltWithProfileCategories(profileHtml),
  };
};

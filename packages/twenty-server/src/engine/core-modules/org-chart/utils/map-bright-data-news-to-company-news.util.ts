import { isNonEmptyString } from '@sniptt/guards';

import type { BrightDataSerpGoogleJson } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';
import type { CompanyNewsLlmResult } from '../schemas/company-news.schema';

export const mapBrightDataNewsToCompanyNewsResult = (input: {
  companyName: string;
  location?: string;
  serp: BrightDataSerpGoogleJson;
}): CompanyNewsLlmResult => {
  const newsItems = (input.serp.news ?? [])
    .map((entry) => {
      const url = entry.link?.trim() ?? '';
      const title = entry.title?.trim() ?? '';

      if (!isNonEmptyString(url) || !isNonEmptyString(title)) {
        return null;
      }

      const source = entry.source?.trim();
      const summary = isNonEmptyString(source) ? `${title} (${source})` : title;

      return {
        summary,
        date: entry.date?.trim() || 'unknown',
        url,
      };
    })
    .filter(
      (item): item is { summary: string; date: string; url: string } =>
        item !== null,
    );

  const location = input.location?.trim() || 'unknown';
  const notes =
    newsItems.length === 0
      ? 'No Google News results returned for this company.'
      : newsItems.length < 3
        ? `Limited coverage: only ${newsItems.length} news item(s) found.`
        : `Bright Data Fast SERP returned ${newsItems.length} news item(s).`;

  return {
    company_name: input.companyName.trim(),
    location,
    news_items: newsItems,
    notes,
  };
};

export const buildCompanyNewsSearchQuery = (input: {
  companyName: string;
  location?: string;
}): string => {
  const companyName = input.companyName.trim();
  const location = input.location?.trim();

  return isNonEmptyString(location)
    ? `${companyName} ${location}`
    : companyName;
};

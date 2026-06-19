import type { SuperImposeAutocompleteItem } from 'src/engine/core-modules/org-chart/types/super-impose.types';
import { extractLinkedinCompanySlugFromUrl } from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import { resolveOrgChartCanonicalCompanyId } from 'twenty-shared';

const normalizeCompanyName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

export const pickBestCompanySearchMatch = (
  companyName: string,
  results: SuperImposeAutocompleteItem[],
): SuperImposeAutocompleteItem | null => {
  if (results.length === 0) {
    return null;
  }

  const normalizedTarget = normalizeCompanyName(companyName);
  const exactMatch = results.find(
    (item) => normalizeCompanyName(item.title) === normalizedTarget,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const containsMatch = results.find((item) => {
    const normalizedTitle = normalizeCompanyName(item.title);
    return (
      normalizedTitle.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedTitle)
    );
  });
  if (containsMatch) {
    return containsMatch;
  }

  return results[0] ?? null;
};

export const resolveCompanySlugFromAutocompleteItem = (
  item: SuperImposeAutocompleteItem,
): string | undefined => {
  if (item.slug?.trim()) {
    return resolveOrgChartCanonicalCompanyId(item.slug.trim());
  }

  if (item.profileUrl?.trim()) {
    const fromUrl = extractLinkedinCompanySlugFromUrl(item.profileUrl);
    if (fromUrl) {
      return resolveOrgChartCanonicalCompanyId(fromUrl);
    }
  }

  if (item.id?.trim()) {
    return resolveOrgChartCanonicalCompanyId(item.id.trim());
  }

  return undefined;
};

export const buildLinkedinCompanyUrl = (slug: string): string =>
  `https://www.linkedin.com/company/${slug}/`;

export const buildOrgChartUrl = (frontendUrl: string, slug: string): string => {
  const base = frontendUrl.replace(/\/$/, '');
  return `${base}/org-chart/${encodeURIComponent(slug)}`;
};

export const normalizeLlmJsonContent = (response: unknown): string | null => {
  if (
    typeof response === 'object' &&
    response !== null &&
    'content' in response
  ) {
    const content = (response as { content?: unknown }).content;
    if (typeof content === 'string') {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const joined = content
        .map((item) => {
          if (
            typeof item === 'object' &&
            item !== null &&
            'text' in item &&
            typeof (item as { text?: unknown }).text === 'string'
          ) {
            return (item as { text: string }).text;
          }
          return '';
        })
        .join('')
        .trim();
      return joined.length > 0 ? joined : null;
    }
  }

  if (typeof response === 'string') {
    return response.trim();
  }

  return null;
};

export const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

import { normalizeTheOrgSlugInput } from 'src/engine/core-modules/theorg/utils/theorg-slug-candidates.util';

/**
 * Google search URL for `"{linkedinStyleSlug} site:theorg.com"` (Bright Data SERP input).
 */
export function buildGoogleTheOrgSiteSearchUrl(linkedinStyleSlug: string): string {
  const q = encodeURIComponent(`${linkedinStyleSlug} site:theorg.com`);
  return `https://www.google.com/search?q=${q}`;
}

/**
 * From SERP organic links, returns the first TheOrg company slug (`/org/{slug}`).
 * Matches profile URLs under `/org/{slug}/org-chart/...` as well as the org home page.
 */
export function extractTheOrgCompanySlugFromSerpOrganic(
  organic: Array<{ link?: string | null }> | undefined | null,
): string | null {
  if (!organic?.length) {
    return null;
  }

  for (const entry of organic) {
    const link = entry.link?.trim();
    if (!link) {
      continue;
    }
    const slug = extractTheOrgCompanySlugFromTheOrgUrl(link);
    if (slug) {
      return slug;
    }
  }

  return null;
}

function extractTheOrgCompanySlugFromTheOrgUrl(link: string): string | null {
  try {
    const u = new URL(link);
    const host = u.hostname.toLowerCase();
    if (host !== 'theorg.com' && !host.endsWith('.theorg.com')) {
      return null;
    }
    const parts = u.pathname.split('/').filter((p) => p.length > 0);
    if (parts[0]?.toLowerCase() !== 'org' || !parts[1]) {
      return null;
    }
    return normalizeTheOrgSlugInput(parts[1]);
  } catch {
    return null;
  }
}

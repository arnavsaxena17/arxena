import type { BrightDataSerpOrganicEntry } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';
import { normalizeTheOfficialBoardSlugInput } from 'src/engine/core-modules/theofficialboard/utils/theofficialboard-slug-candidates.util';

export function buildGoogleTheOfficialBoardSiteSearchUrl(
  companySearchTerm: string,
): string {
  const q = encodeURIComponent(
    `${companySearchTerm} site:theofficialboard.com/org-chart`,
  );

  return `https://www.google.com/search?q=${q}`;
}

export function extractTheOfficialBoardSlugFromSerpOrganic(
  organic: BrightDataSerpOrganicEntry[] | undefined | null,
): string | null {
  if (!organic?.length) {
    return null;
  }

  for (const entry of organic) {
    const link = entry.link?.trim();

    if (!link) {
      continue;
    }

    const slug = extractTheOfficialBoardSlugFromUrl(link);

    if (slug) {
      return slug;
    }
  }

  return null;
}

function extractTheOfficialBoardSlugFromUrl(link: string): string | null {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();

    if (host !== 'theofficialboard.com' && !host.endsWith('.theofficialboard.com')) {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[0]?.toLowerCase() !== 'org-chart' || !parts[1]) {
      return null;
    }

    return normalizeTheOfficialBoardSlugInput(parts[1]);
  } catch {
    return null;
  }
}

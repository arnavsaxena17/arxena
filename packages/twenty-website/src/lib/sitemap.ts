import { toSlug } from 'twenty-shared';

import { PRODUCT_SLUGS, SOLUTION_SLUGS } from '@/lib/marketing-site-pages';

/** Canonical marketing site origin for sitemap `<loc>` and robots when env points at localhost. */
export const CANONICAL_SITE_URL = 'https://arxena.com';
export const SITEMAP_INDEX_FILENAME = 'sitemap-main.xml';
export const SITEMAP_CHILD_PREFIX = 'sitemap-pages-';

/**
 * Gradual rollout batch sizes (URLs per sitemap):
 * Week 1: 500, Week 2: 2500, Week 3: 5000, Week 4: 25000, Week 5: 50000, Week 6+: 50000 each
 */
export const BATCH_SIZES = [500, 2500, 5000, 25000, 50000];

/**
 * Company-level batch sizes for sitemap (companies per batch, largest first).
 * Batch 0: top 50, Batch 1: next 200, Batch 2: next 500, etc.
 */
export const COMPANY_BATCH_SIZES = [50, 200, 500, 1000, 2000];

export function getCompanyOffsetAndLimit(batchIndex: number): {
  offset: number;
  limit: number;
} {
  if (batchIndex === 0) {
    return { offset: 0, limit: COMPANY_BATCH_SIZES[0] };
  }
  let offset = 0;
  for (let i = 0; i < batchIndex; i++) {
    offset += COMPANY_BATCH_SIZES[Math.min(i, COMPANY_BATCH_SIZES.length - 1)];
  }
  const limit =
    batchIndex < COMPANY_BATCH_SIZES.length
      ? COMPANY_BATCH_SIZES[batchIndex]
      : COMPANY_BATCH_SIZES[COMPANY_BATCH_SIZES.length - 1];
  return { offset, limit };
}

export function getOffsetAndLimit(batchIndex: number): {
  offset: number;
  limit: number;
} {
  if (batchIndex === 0) {
    return { offset: 0, limit: BATCH_SIZES[0] };
  }
  let offset = 0;
  for (let i = 0; i < batchIndex; i++) {
    offset += BATCH_SIZES[Math.min(i, BATCH_SIZES.length - 1)];
  }
  const limit =
    batchIndex < BATCH_SIZES.length
      ? BATCH_SIZES[batchIndex]
      : BATCH_SIZES[BATCH_SIZES.length - 1];
  return { offset, limit };
}

export function buildOrgChartPath(
  companyId: string,
  country: string,
  type: string,
): string {
  if (country === 'global' && type === 'fullcompany') {
    return `/org-chart/${encodeURIComponent(companyId)}`;
  }
  if (type === 'fullcompany') {
    const countrySegment = country === 'global' ? 'global' : toSlug(country);
    return `/org-chart/${encodeURIComponent(companyId)}/${countrySegment}`;
  }
  if (country === 'global') {
    const typeSegment = type === 'fullcompany' ? 'fullcompany' : toSlug(type);
    return `/org-chart/${encodeURIComponent(companyId)}/global/${typeSegment}`;
  }
  return `/org-chart/${encodeURIComponent(companyId)}/${toSlug(country)}/${toSlug(type)}`;
}

export const STATIC_ROUTES = [
  '/',
  '/pricing',
  '/engage',
  '/chrome-extension',
  '/story',
  '/team',
  '/products',
  ...PRODUCT_SLUGS.map((slug) => `/products/${slug}`),
  '/solutions',
  ...SOLUTION_SLUGS.map((slug) => `/solutions/${slug}`),
  '/resources',
  '/resources/blog',
  '/resources/org-intelligence-reports',
  '/resources/calculators',
  '/legal/terms',
  '/legal/privacy',
];

/** Letters for a-z company list browsing. */
const COMPANY_LIST_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Get company list URLs for a sitemap batch.
 * Batch 0: /companies + /companies/a-1, /companies/b-1, ..., /companies/z-1
 * Batch 1: /companies/a-2, ..., /companies/z-2
 * etc.
 */
export function getCompanyListUrlsForBatch(batchIndex: number): string[] {
  const page = batchIndex + 1;
  const urls: string[] = [];
  if (batchIndex === 0) {
    urls.push('/companies');
  }
  for (const letter of COMPANY_LIST_LETTERS) {
    urls.push(`/companies/${letter}-${page}`);
  }
  return urls;
}

/**
 * Number of sitemap batches to expose. Increment from 0 to 400 over rollout.
 * Use 0 for empty index (no org chart sitemaps).
 */
export function getExposedBatchCount(): number {
  const val = process.env.SITEMAP_EXPOSED_BATCH_COUNT;
  const n = val ? parseInt(val, 10) : 1;
  if (Number.isNaN(n) || n < 0) return 1;
  return Math.min(n, 400);
}

/**
 * Phase 1 = batch 0 only = global fullcompany URLs (/org-chart/{companyId}).
 * Phase 2 = batches 1+ = country/function URLs (/org-chart/{companyId}/{country}, etc.)
 * When SITEMAP_EXPOSED_BATCH_COUNT is 0 or 1, only Phase 1 is in the sitemap.
 * Use this to gate country/function browse pages and Phase 2 org chart URLs.
 */
export function isPhase2Exposed(): boolean {
  return getExposedBatchCount() > 1;
}

/**
 * Cumulative URL count for batches 0 through (exposedCount - 1).
 * Used for maxExposedCount when gating browse pages.
 */
export function getMaxExposedUrlCount(exposedCount: number): number {
  if (exposedCount <= 0) return 0;
  let total = 0;
  for (let i = 0; i < exposedCount; i++) {
    const { limit } = getOffsetAndLimit(i);
    total += limit;
  }
  return total;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sitemapEntryToXml(
  url: string,
  lastModified: Date,
  changeFrequency: string,
  priority: number,
): string {
  return `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
    <changefreq>${changeFrequency}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/** Zero-padded sitemap filename: 0 -> "001", 1 -> "002", etc. */
export function formatSitemapId(batchIndex: number): string {
  return `${SITEMAP_CHILD_PREFIX}${String(batchIndex + 1).padStart(3, '0')}.xml`;
}

export function sitemapIndexEntryToXml(
  url: string,
  lastModified: Date,
): string {
  return `  <sitemap>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
  </sitemap>`;
}

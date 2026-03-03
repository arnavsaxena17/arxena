import { MetadataRoute } from 'next';

import { toSlug } from 'twenty-shared';

import indexedCompanies from '@/data/indexed-org-charts.json';
import { getBaseUrl } from '@/lib/base-url';

export const revalidate = 3600;

function buildOrgChartPath(
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getBaseUrl();
  const entries: MetadataRoute.Sitemap = [];

  // Static routes - key pages for sitelinks
  const staticRoutes = [
    '/',
    '/pricing',
    '/engage',
    '/story',
    '/legal/terms',
    '/legal/privacy',
  ];
  for (const path of staticRoutes) {
    entries.push({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: path === '/' ? 'weekly' : 'monthly',
      priority: path === '/' ? 1 : 0.8,
    });
  }

  // Org chart URLs - fetch indexed URLs from API for each company
  const companies = (
    indexedCompanies as { companies: Array<{ companyId: string }> }
  ).companies;

  for (const company of companies) {
    const companyId = company.companyId;
    let urls: { country: string; type: string }[] = [];

    try {
      const res = await fetch(
        `${baseUrl}/api/org-chart/companies/${encodeURIComponent(companyId)}/indexed-urls`,
        { next: { revalidate: 3600 } },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          urls?: { country: string; type: string }[];
        };
        urls = data.urls ?? [];
      }
    } catch {
      // Fallback: at least include base URL
      urls = [{ country: 'global', type: 'fullcompany' }];
    }

    if (urls.length === 0) {
      urls = [{ country: 'global', type: 'fullcompany' }];
    }

    for (const { country, type } of urls) {
      // Exclude /0 paths - they represent root nodes and are not meaningful for SEO
      if (type === '0') continue;

      const path = buildOrgChartPath(companyId, country, type);
      entries.push({
        url: `${baseUrl}${path}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  return entries;
}

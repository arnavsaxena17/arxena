import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import indexedCompanies from '@/data/indexed-org-charts.json';

export const revalidate = 3600;

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (envUrl) {
    const base = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    return base.replace(/\/$/, '');
  }
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3002';
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
}

function buildOrgChartPath(
  companyId: string,
  country: string,
  type: string,
): string {
  if (country === 'global' && type === 'fullcompany') {
    return `/org-chart/${encodeURIComponent(companyId)}`;
  }
  if (type === 'fullcompany') {
    return `/org-chart/${encodeURIComponent(companyId)}/${encodeURIComponent(country)}`;
  }
  if (country === 'global') {
    return `/org-chart/${encodeURIComponent(companyId)}/global/${encodeURIComponent(type)}`;
  }
  return `/org-chart/${encodeURIComponent(companyId)}/${encodeURIComponent(country)}/${encodeURIComponent(type)}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getBaseUrl();
  const entries: MetadataRoute.Sitemap = [];

  // Static routes
  const staticRoutes = ['/', '/pricing', '/engage', '/story'];
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

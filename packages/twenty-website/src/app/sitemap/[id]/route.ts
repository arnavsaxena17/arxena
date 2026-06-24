import { NextRequest, NextResponse } from 'next/server';

import { getBaseUrl } from '@/lib/base-url';
import {
  buildOrgChartPath,
  getExposedBatchCount,
  sitemapEntryToXml,
  STATIC_ROUTES,
} from '@/lib/sitemap';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`Sitemap dependency failed: ${url} returned ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // id is "001", "002", etc. (1-based) -> batchIndex 0, 1, 2...
  const batchIndex = Math.max(0, parseInt(id, 10) || 1) - 1;
  const count = getExposedBatchCount();

  if (batchIndex < 0 || batchIndex >= count) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const baseUrl = await getBaseUrl();
  const entries: string[] = [];

  // Sitemap 0 includes static routes
  if (batchIndex === 0) {
    for (const path of STATIC_ROUTES) {
      entries.push(
        sitemapEntryToXml(
          `${baseUrl}${path}`,
          new Date(),
          path === '/' ? 'weekly' : 'monthly',
          path === '/' ? 1 : 0.8,
        ),
      );
    }
  }

  try {
    const paramsData = await fetchJsonOrThrow<{
      country?: string;
      type?: string;
      offset?: number;
      limit?: number;
    }>(
      `${baseUrl}/api/org-chart/companies/sitemap-batch-params?batchIndex=${batchIndex}`,
    );
    const batchParams = paramsData.country != null ? paramsData : null;

    if (!batchParams || batchParams.limit == null || batchParams.limit <= 0) {
      // No org chart URLs for this batch (e.g. beyond Phase 2 slices)
    } else {
      const url = new URL(`${baseUrl}/api/org-chart/companies/sitemap-urls`);
      url.searchParams.set('offset', String(batchParams.offset ?? 0));
      url.searchParams.set('limit', String(batchParams.limit));
      if (batchParams.country)
        url.searchParams.set('country', batchParams.country);
      if (batchParams.type) url.searchParams.set('type', batchParams.type);

      const data = await fetchJsonOrThrow<{
        urls?: Array<{ companyId: string; country: string; type: string }>;
      }>(url.toString());
      const urls = data.urls ?? [];
      const lastMod = new Date();
      for (const { companyId, country, type } of urls) {
        if (!companyId?.trim()) continue;
        const path = buildOrgChartPath(companyId, country, type);
        entries.push(
          sitemapEntryToXml(`${baseUrl}${path}`, lastMod, 'monthly', 0.8),
        );
      }
    }
  } catch {
    return new NextResponse('Sitemap temporarily unavailable', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

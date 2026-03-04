import { NextResponse } from 'next/server';

import { getBaseUrl } from '@/lib/base-url';
import {
    formatSitemapId,
    getExposedBatchCount,
    sitemapIndexEntryToXml,
} from '@/lib/sitemap';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const baseUrl = await getBaseUrl();
  const count = getExposedBatchCount();
  const lastMod = new Date();

  const sitemapEntries =
    count === 0
      ? []
      : Array.from({ length: count }, (_, i) =>
          sitemapIndexEntryToXml(
            `${baseUrl}/sitemap-${formatSitemapId(i)}.xml`,
            lastMod,
          ),
        );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import { CANONICAL_SITE_URL, SITEMAP_INDEX_FILENAME } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  let baseUrl: string;
  if (envUrl) {
    baseUrl = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
  } else {
    const headersList = await headers();
    const host = headersList.get('host') ?? 'localhost:3002';
    const protocol = headersList.get('x-forwarded-proto') ?? 'http';
    baseUrl = `${protocol}://${host}`;
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  // Use canonical domain for sitemap so robots.txt works across http/https and www/non-www variants
  const isProduction =
    baseUrl.includes('arxena.com') || baseUrl.includes('vercel.app');
  const sitemapBase = isProduction ? CANONICAL_SITE_URL : baseUrl;

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${sitemapBase}/${SITEMAP_INDEX_FILENAME}`,
  };
}

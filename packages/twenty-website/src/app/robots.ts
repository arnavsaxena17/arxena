import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

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

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
